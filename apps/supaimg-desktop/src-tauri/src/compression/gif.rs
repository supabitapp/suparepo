use super::CompressionError;
use gif::{ColorOutput, DecodeOptions, DisposalMethod, Encoder, Frame, Repeat};
use std::borrow::Cow;
use std::collections::HashMap;
use std::io::Cursor;

const TRANSP: u32 = 0;
const REQUIRED: u8 = 2;
const REPLACE_TRANSP: u8 = 1;
const NOT_IN_OUT_GLOBAL: i16 = -1;
const OPT_LEVEL: i32 = 2;

#[derive(Clone)]
struct RawFrame {
    left: u16,
    top: u16,
    width: u16,
    height: u16,
    delay: u16,
    dispose: DisposalMethod,
    transparent: Option<u8>,
    local_palette: Option<Vec<[u8; 3]>>,
    buffer: Vec<u8>,
    palette_union_map: Vec<u32>,
}

struct GifStream {
    width: u16,
    height: u16,
    background: Option<u8>,
    repeat: Repeat,
    global_palette: Option<Vec<[u8; 3]>>,
    frames: Vec<RawFrame>,
}

#[derive(Clone)]
struct OptFrame {
    left: u16,
    top: u16,
    width: u16,
    height: u16,
    disposal: DisposalMethod,
    needed_colors: Vec<u8>,
    required_color_count: usize,
    global_penalty: i32,
    colormap_penalty: i32,
    active_penalty: i32,
}

#[derive(Clone, Copy)]
struct Bounds {
    left: usize,
    top: usize,
    width: usize,
    height: usize,
}

pub fn compress_gif_lossless(input: &[u8]) -> Result<Vec<u8>, CompressionError> {
    compress_gif_lossless_with_progress(input, &mut |_| {})
}

pub fn compress_gif_lossless_with_progress<F: FnMut(f64) + Send>(
    input: &[u8],
    on_progress: &mut F,
) -> Result<Vec<u8>, CompressionError> {
    let mut progress = LosslessProgress::new(on_progress);

    let mut stream = decode_gif(input)?;
    if stream.frames.is_empty() {
        return Err(CompressionError::DecodeFailed(
            "gif has no frames".to_string(),
        ));
    }

    let (all_colors, color_to_union) = build_all_palette(&stream);
    let background = compute_background(&stream, &color_to_union);
    assign_palette_union_maps(&mut stream, &color_to_union);
    progress.advance_decode();

    let mut opt_frames = create_subimages(&stream, &all_colors, background, &mut |inner| {
        progress.update_subimages(inner);
    })
    .map_err(CompressionError::EncodeFailed)?;
    progress.finish_subimages();

    let (out_global_palette, all_to_global) =
        create_out_global_map(&all_colors, &mut opt_frames, background);
    progress.advance_global_map();

    let optimized_frames = create_new_image_data(
        &stream,
        &all_colors,
        &all_to_global,
        &out_global_palette,
        &opt_frames,
        background,
        &mut |inner| progress.update_new_data(inner),
    )?;
    progress.finish_new_data();

    let output = encode_gif(
        stream.width,
        stream.height,
        stream.repeat,
        &out_global_palette,
        optimized_frames,
    )?;
    progress.finish_encode();
    Ok(output)
}

fn decode_gif(input: &[u8]) -> Result<GifStream, CompressionError> {
    let mut options = DecodeOptions::new();
    options.set_color_output(ColorOutput::Indexed);
    let mut decoder = options
        .read_info(Cursor::new(input))
        .map_err(|err| CompressionError::DecodeFailed(err.to_string()))?;

    let width = decoder.width();
    let height = decoder.height();
    let background = decoder.bg_color().map(|v| v as u8);
    let repeat = decoder.repeat();
    let global_palette = decoder
        .global_palette()
        .map(bytes_to_colors)
        .filter(|colors| !colors.is_empty());

    let mut frames = Vec::new();
    while let Some(frame) = decoder
        .read_next_frame()
        .map_err(|err| CompressionError::DecodeFailed(err.to_string()))?
    {
        let frame = frame.clone();
        let palette = frame.palette.as_ref().map(|pal| bytes_to_colors(pal));
        let palette_len = palette
            .as_ref()
            .or(global_palette.as_ref())
            .map(|pal| pal.len())
            .unwrap_or(0);
        let transparent = frame
            .transparent
            .filter(|&idx| (idx as usize) < palette_len);

        frames.push(RawFrame {
            left: frame.left,
            top: frame.top,
            width: frame.width,
            height: frame.height,
            delay: frame.delay,
            dispose: frame.dispose,
            transparent,
            local_palette: palette,
            buffer: frame.buffer.into_owned(),
            palette_union_map: Vec::new(),
        });
    }

    if frames.is_empty() {
        return Err(CompressionError::DecodeFailed(
            "gif has no frames".to_string(),
        ));
    }

    Ok(GifStream {
        width,
        height,
        background,
        repeat,
        global_palette,
        frames,
    })
}

fn bytes_to_colors(bytes: &[u8]) -> Vec<[u8; 3]> {
    bytes
        .chunks_exact(3)
        .map(|chunk| [chunk[0], chunk[1], chunk[2]])
        .collect()
}

fn build_all_palette(stream: &GifStream) -> (Vec<[u8; 3]>, HashMap<u32, u32>) {
    let mut all_colors = vec![[255, 255, 255]];
    let mut color_to_union = HashMap::new();

    let mut add_palette = |palette: &[[u8; 3]]| {
        for color in palette {
            let key = rgb_key(*color);
            color_to_union.entry(key).or_insert_with(|| {
                let idx = all_colors.len() as u32;
                all_colors.push(*color);
                idx
            });
        }
    };

    if let Some(global) = stream.global_palette.as_ref() {
        add_palette(global);
    }

    for frame in &stream.frames {
        if let Some(local) = frame.local_palette.as_ref() {
            add_palette(local);
        }
    }

    if let Some(trans_color) = first_transparent_color(stream) {
        all_colors[0] = trans_color;
    }

    (all_colors, color_to_union)
}

fn first_transparent_color(stream: &GifStream) -> Option<[u8; 3]> {
    for frame in &stream.frames {
        if let Some(idx) = frame.transparent {
            let palette = frame
                .local_palette
                .as_ref()
                .or(stream.global_palette.as_ref())?;
            if let Some(color) = palette.get(idx as usize) {
                return Some(*color);
            }
        }
    }
    None
}

fn compute_background(stream: &GifStream, color_to_union: &HashMap<u32, u32>) -> u32 {
    let Some(bg_idx) = stream.background else {
        return TRANSP;
    };
    let Some(global) = stream.global_palette.as_ref() else {
        return TRANSP;
    };
    if stream
        .frames
        .iter()
        .any(|frame| frame.local_palette.is_none() && frame.transparent == Some(bg_idx))
    {
        return TRANSP;
    }
    let Some(color) = global.get(bg_idx as usize) else {
        return TRANSP;
    };
    let key = rgb_key(*color);
    color_to_union.get(&key).copied().unwrap_or(TRANSP)
}

fn assign_palette_union_maps(stream: &mut GifStream, color_to_union: &HashMap<u32, u32>) {
    for frame in &mut stream.frames {
        let palette = frame
            .local_palette
            .as_ref()
            .or(stream.global_palette.as_ref())
            .expect("palette required");
        frame.palette_union_map = palette
            .iter()
            .map(|color| color_to_union[&rgb_key(*color)])
            .collect();
        if let Some(t) = frame.transparent {
            if let Some(entry) = frame.palette_union_map.get_mut(t as usize) {
                *entry = TRANSP;
            }
        }
    }
}

fn rgb_key(color: [u8; 3]) -> u32 {
    ((color[0] as u32) << 16) | ((color[1] as u32) << 8) | color[2] as u32
}

fn create_subimages(
    stream: &GifStream,
    all_colors: &[[u8; 3]],
    background: u32,
    on_progress: &mut dyn FnMut(f64),
) -> Result<Vec<OptFrame>, String> {
    let screen_w = stream.width as usize;
    let screen_h = stream.height as usize;
    let screen_size = screen_w * screen_h;
    let mut last_data = vec![background; screen_size];
    let mut this_data = vec![background; screen_size];
    let mut next_data = vec![background; screen_size];
    let mut previous_data: Option<Vec<u32>> = None;
    let mut next_data_valid = false;
    let mut opt_frames = Vec::with_capacity(stream.frames.len());
    let mut local_color_tables = false;
    let mut last_frame: Option<&RawFrame> = None;

    for (index, frame) in stream.frames.iter().enumerate() {
        if frame.local_palette.is_some() {
            local_color_tables = true;
        }

        if frame.dispose == DisposalMethod::Previous
            || (local_color_tables
                && index > 0
                && last_frame
                    .map(|f| is_disposal_reset(f.dispose))
                    .unwrap_or(false))
        {
            if previous_data.is_none() {
                previous_data = Some(vec![background; screen_size]);
            }
            if let Some(prev) = previous_data.as_mut() {
                prev.copy_from_slice(&this_data);
            }
        }

        if next_data_valid {
            std::mem::swap(&mut this_data, &mut next_data);
            next_data_valid = false;
        } else {
            apply_frame(
                &mut this_data,
                screen_w,
                screen_h,
                frame,
                &frame.palette_union_map,
                frame.transparent.is_none(),
            );
        }

        let mut subimage = OptFrame {
            left: 0,
            top: 0,
            width: 1,
            height: 1,
            disposal: DisposalMethod::Any,
            needed_colors: Vec::new(),
            required_color_count: 0,
            global_penalty: 1,
            colormap_penalty: 1,
            active_penalty: 1,
        };

        loop {
            if index > 0 {
                find_difference_bounds(
                    &mut subimage,
                    frame,
                    last_frame,
                    &last_data,
                    &this_data,
                    screen_w,
                    screen_h,
                );
            } else {
                let ob = safe_bounds(frame, screen_w, screen_h);
                subimage.left = ob.left as u16;
                subimage.top = ob.top as u16;
                subimage.width = ob.width as u16;
                subimage.height = ob.height as u16;
            }

            if is_disposal_reset(frame.dispose) && index + 1 < stream.frames.len() {
                if let Some(prev) = previous_data.as_ref() {
                    apply_frame_disposal(
                        &mut next_data,
                        &this_data,
                        prev,
                        frame,
                        screen_w,
                        screen_h,
                        background,
                    );
                } else {
                    next_data.copy_from_slice(&this_data);
                    erase_data_area(&mut next_data, frame, screen_w, screen_h, background);
                }

                let next_frame = &stream.frames[index + 1];
                apply_frame(
                    &mut next_data,
                    screen_w,
                    screen_h,
                    next_frame,
                    &next_frame.palette_union_map,
                    next_frame.transparent.is_none(),
                );
                next_data_valid = true;

                if expand_difference_bounds(
                    &mut subimage,
                    frame,
                    &this_data,
                    &next_data,
                    screen_w,
                    screen_h,
                    background,
                ) {
                    subimage.disposal = DisposalMethod::Background;
                }
            }

            fix_difference_bounds(&mut subimage, screen_w, screen_h);

            if index + 1 == stream.frames.len() {
                subimage.disposal = frame.dispose;
            }

            let mut use_transparency = OPT_LEVEL > 1 && index > 0;
            if index == 0 && background == TRANSP {
                use_transparency = true;
            }

            get_used_colors(
                &mut subimage,
                use_transparency,
                &this_data,
                &last_data,
                all_colors.len(),
                screen_w,
            );

            if subimage.required_color_count > 256 {
                if index > 0 && local_color_tables {
                    if let Some(last) = last_frame {
                        if is_disposal_reset(last.dispose) && subimage.disposal != last.dispose {
                            subimage.disposal = last.dispose;
                            if let Some(prev) = previous_data.as_ref() {
                                last_data.copy_from_slice(prev);
                            }
                            continue;
                        }
                    }
                }
                return Err("gif frame requires > 256 colors".to_string());
            }

            break;
        }

        if subimage.disposal == DisposalMethod::Background {
            erase_data_area_subimage(&mut last_data, &subimage, screen_w, background);
        } else {
            copy_data_area_subimage(&mut last_data, &this_data, &subimage, screen_w);
        }

        if frame.dispose == DisposalMethod::Background {
            erase_data_area(&mut this_data, frame, screen_w, screen_h, background);
        } else if frame.dispose == DisposalMethod::Previous {
            if let Some(prev) = previous_data.as_mut() {
                std::mem::swap(prev, &mut this_data);
            }
        }

        opt_frames.push(subimage);
        last_frame = Some(frame);
        let progress = (index + 1) as f64 / stream.frames.len().max(1) as f64;
        on_progress(progress.min(1.0));
    }

    Ok(opt_frames)
}

struct LosslessProgress<'a> {
    on_progress: &'a mut (dyn FnMut(f64) + Send),
    base: f64,
    decode_weight: f64,
    subimages_weight: f64,
    global_weight: f64,
    new_data_weight: f64,
    encode_weight: f64,
}

impl<'a> LosslessProgress<'a> {
    fn new(on_progress: &'a mut (dyn FnMut(f64) + Send)) -> Self {
        let mut progress = Self {
            on_progress,
            base: 0.0,
            decode_weight: 0.1,
            subimages_weight: 0.5,
            global_weight: 0.1,
            new_data_weight: 0.25,
            encode_weight: 0.05,
        };
        progress.emit(0.0);
        progress
    }

    fn emit(&mut self, value: f64) {
        (self.on_progress)(value.clamp(0.0, 1.0));
    }

    fn advance_decode(&mut self) {
        self.base += self.decode_weight;
        self.emit(self.base);
    }

    fn update_subimages(&mut self, inner: f64) {
        self.emit(self.base + self.subimages_weight * inner);
    }

    fn finish_subimages(&mut self) {
        self.base += self.subimages_weight;
        self.emit(self.base);
    }

    fn advance_global_map(&mut self) {
        self.base += self.global_weight;
        self.emit(self.base);
    }

    fn update_new_data(&mut self, inner: f64) {
        self.emit(self.base + self.new_data_weight * inner);
    }

    fn finish_new_data(&mut self) {
        self.base += self.new_data_weight;
        self.emit(self.base);
    }

    fn finish_encode(&mut self) {
        self.base += self.encode_weight;
        self.emit(1.0);
    }
}

fn create_out_global_map(
    all_colors: &[[u8; 3]],
    frames: &mut [OptFrame],
    background: u32,
) -> (Vec<[u8; 3]>, Vec<i16>) {
    let all_ncol = all_colors.len();
    let mut all_to_global = vec![NOT_IN_OUT_GLOBAL; all_ncol];
    let reserve_transparent = background == TRANSP;
    let max_global = if reserve_transparent { 255 } else { 256 };
    let max_all = max_global + 1;

    if all_ncol <= 1 {
        return (Vec::new(), all_to_global);
    }

    for frame in frames.iter_mut() {
        let mut penalty = 1;
        let mut pi = 2;
        while pi < frame.required_color_count {
            penalty *= 3;
            pi *= 2;
        }
        frame.global_penalty = 1;
        frame.colormap_penalty = penalty;
        frame.active_penalty = if all_ncol > max_all {
            frame.colormap_penalty
        } else {
            frame.global_penalty
        };
    }

    let mut penalty = vec![0i32; all_ncol];
    for frame in frames.iter() {
        increment_penalties(frame, &mut penalty, frame.active_penalty);
    }

    let mut permute: Vec<usize> = (1..all_ncol).collect();
    let mut ordering = vec![0usize; all_ncol];

    let mut cur_ncol = all_ncol - 1;
    while cur_ncol > 0 {
        permute[0..cur_ncol].sort_by(|&a, &b| penalty[b].cmp(&penalty[a]));

        let removed = permute[cur_ncol - 1];
        ordering[removed] = cur_ncol - 1;

        for frame in frames.iter_mut() {
            if frame.global_penalty > 0 && frame.needed_colors[removed] == REQUIRED {
                increment_penalties(frame, &mut penalty, -frame.active_penalty);
                frame.global_penalty = 0;
                frame.colormap_penalty = if cur_ncol > max_global { -1 } else { 0 };
            }
        }

        if cur_ncol == max_global + 1 {
            penalty.fill(0);
            for frame in frames.iter_mut() {
                frame.active_penalty = frame.global_penalty;
                increment_penalties(frame, &mut penalty, frame.global_penalty);
            }
        }

        cur_ncol -= 1;
    }

    if background != TRANSP {
        let bg = background as usize;
        if bg < ordering.len() && ordering[bg] >= 256 {
            let other = permute[255];
            ordering[other] = ordering[bg];
            ordering[bg] = 255;
        }
    }

    let nglobal_all = if reserve_transparent {
        if all_ncol <= max_all {
            all_ncol
        } else {
            max_all
        }
    } else if all_ncol <= max_all {
        all_ncol - 1
    } else {
        max_global
    };
    let mut out_global = vec![[0, 0, 0]; nglobal_all];
    if reserve_transparent && !out_global.is_empty() {
        out_global[0] = all_colors[TRANSP as usize];
        all_to_global[TRANSP as usize] = 0;
        for i in 1..all_ncol {
            if ordering[i] < max_global {
                let slot = ordering[i] + 1;
                if let Some(entry) = out_global.get_mut(slot) {
                    *entry = all_colors[i];
                }
                all_to_global[i] = slot as i16;
            } else {
                all_to_global[i] = NOT_IN_OUT_GLOBAL;
            }
        }
    } else {
        for i in 1..all_ncol {
            if ordering[i] < max_global {
                if let Some(slot) = out_global.get_mut(ordering[i]) {
                    *slot = all_colors[i];
                }
                all_to_global[i] = ordering[i] as i16;
            } else {
                all_to_global[i] = NOT_IN_OUT_GLOBAL;
            }
        }
    }

    if background != TRANSP {
        let bg_union = background as usize;
        if bg_union < all_to_global.len() {
            let bg_idx = all_to_global[bg_union];
            if bg_idx > 0 {
                let bg_idx = bg_idx as usize;
                if bg_idx < out_global.len() {
                    out_global.swap(0, bg_idx);
                    for entry in &mut all_to_global {
                        if *entry == 0 {
                            *entry = bg_idx as i16;
                        } else if *entry == bg_idx as i16 {
                            *entry = 0;
                        }
                    }
                }
            }
        }
    }

    (out_global, all_to_global)
}

fn create_new_image_data<F: FnMut(f64) + Send>(
    stream: &GifStream,
    all_colors: &[[u8; 3]],
    all_to_global: &[i16],
    out_global_palette: &[[u8; 3]],
    opt_frames: &[OptFrame],
    background: u32,
    on_progress: &mut F,
) -> Result<Vec<Frame<'static>>, CompressionError> {
    let screen_w = stream.width as usize;
    let screen_h = stream.height as usize;
    let screen_size = screen_w * screen_h;
    let mut last_data = vec![background; screen_size];
    let mut this_data = vec![background; screen_size];
    let mut previous_data: Option<Vec<u32>> = None;
    let mut output_frames = Vec::with_capacity(stream.frames.len());

    for (index, frame) in stream.frames.iter().enumerate() {
        let opt = &opt_frames[index];

        if frame.dispose == DisposalMethod::Previous {
            if previous_data.is_none() {
                previous_data = Some(vec![background; screen_size]);
            }
            if let Some(prev) = previous_data.as_mut() {
                prev.copy_from_slice(&this_data);
            }
        }

        apply_frame(
            &mut this_data,
            screen_w,
            screen_h,
            frame,
            &frame.palette_union_map,
            frame.transparent.is_none(),
        );

        let prepared = prepare_colormap(
            opt,
            all_colors,
            all_to_global,
            out_global_palette,
            background == TRANSP,
        )
        .ok_or_else(|| CompressionError::EncodeFailed("gif palette overflow".to_string()))?;
        let map = prepared.map;
        let local_palette = prepared.local_palette;
        let transparent_idx = prepared.transparent;

        let bounds = Bounds {
            left: opt.left as usize,
            top: opt.top as usize,
            width: opt.width as usize,
            height: opt.height as usize,
        };

        let buffer = build_frame_data(&this_data, &map, bounds, screen_w);
        let transparent = transparent_idx;

        output_frames.push(Frame {
            left: opt.left,
            top: opt.top,
            width: opt.width,
            height: opt.height,
            delay: frame.delay,
            dispose: opt.disposal,
            transparent,
            interlaced: false,
            palette: local_palette.as_deref().map(colors_to_bytes),
            buffer: Cow::Owned(buffer),
            ..Frame::default()
        });

        if opt.disposal == DisposalMethod::Background {
            erase_data_area_subimage(&mut last_data, opt, screen_w, background);
        } else if opt.disposal == DisposalMethod::Previous {
            if let Some(prev) = previous_data.as_ref() {
                copy_data_area_subimage(&mut last_data, prev, opt, screen_w);
            }
        } else {
            copy_data_area_subimage(&mut last_data, &this_data, opt, screen_w);
        }

        if frame.dispose == DisposalMethod::Background {
            erase_data_area(&mut this_data, frame, screen_w, screen_h, background);
        } else if frame.dispose == DisposalMethod::Previous {
            if let Some(prev) = previous_data.as_ref() {
                copy_data_area(&mut this_data, prev, frame, screen_w, screen_h);
            }
        }

        let progress = (index + 1) as f64 / stream.frames.len().max(1) as f64;
        on_progress(progress.min(1.0));
    }

    drop_empty_frames(&mut output_frames);

    Ok(output_frames)
}

fn encode_gif(
    width: u16,
    height: u16,
    repeat: Repeat,
    global_palette: &[[u8; 3]],
    frames: Vec<Frame<'static>>,
) -> Result<Vec<u8>, CompressionError> {
    let global_bytes = colors_to_bytes(global_palette);
    let mut encoder = Encoder::new(Vec::new(), width, height, &global_bytes)
        .map_err(|err| CompressionError::EncodeFailed(err.to_string()))?;
    encoder
        .set_repeat(repeat)
        .map_err(|err| CompressionError::EncodeFailed(err.to_string()))?;

    for frame in frames {
        encoder
            .write_frame(&frame)
            .map_err(|err| CompressionError::EncodeFailed(err.to_string()))?;
    }
    encoder
        .into_inner()
        .map_err(|err| CompressionError::EncodeFailed(err.to_string()))
}

fn colors_to_bytes(colors: &[[u8; 3]]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(colors.len() * 3);
    for color in colors {
        bytes.extend_from_slice(color);
    }
    bytes
}

fn safe_bounds(frame: &RawFrame, screen_w: usize, screen_h: usize) -> Bounds {
    let left = frame.left as usize;
    let top = frame.top as usize;
    let right = left.saturating_add(frame.width as usize).min(screen_w);
    let bottom = top.saturating_add(frame.height as usize).min(screen_h);
    Bounds {
        left: left.min(screen_w),
        top: top.min(screen_h),
        width: right.saturating_sub(left.min(screen_w)),
        height: bottom.saturating_sub(top.min(screen_h)),
    }
}

fn is_disposal_reset(dispose: DisposalMethod) -> bool {
    matches!(
        dispose,
        DisposalMethod::Background | DisposalMethod::Previous
    )
}

fn fix_difference_bounds(bounds: &mut OptFrame, screen_w: usize, screen_h: usize) {
    if bounds.width == 0 || bounds.height == 0 {
        bounds.left = 0;
        bounds.top = 0;
        bounds.width = 1;
        bounds.height = 1;
    }

    if bounds.left as usize >= screen_w {
        bounds.left = (screen_w.saturating_sub(1)) as u16;
    }
    if bounds.top as usize >= screen_h {
        bounds.top = (screen_h.saturating_sub(1)) as u16;
    }
}

fn copy_data_area(
    dst: &mut [u32],
    src: &[u32],
    frame: &RawFrame,
    screen_w: usize,
    screen_h: usize,
) {
    let ob = safe_bounds(frame, screen_w, screen_h);
    if ob.width == 0 || ob.height == 0 {
        return;
    }
    for y in 0..ob.height {
        let row = (ob.top + y) * screen_w + ob.left;
        let slice = &src[row..row + ob.width];
        dst[row..row + ob.width].copy_from_slice(slice);
    }
}

fn copy_data_area_subimage(dst: &mut [u32], src: &[u32], subimage: &OptFrame, screen_w: usize) {
    let ob = Bounds {
        left: subimage.left as usize,
        top: subimage.top as usize,
        width: subimage.width as usize,
        height: subimage.height as usize,
    };
    if ob.width == 0 || ob.height == 0 {
        return;
    }
    for y in 0..ob.height {
        let row = (ob.top + y) * screen_w + ob.left;
        let slice = &src[row..row + ob.width];
        dst[row..row + ob.width].copy_from_slice(slice);
    }
}

fn erase_data_area(dst: &mut [u32], frame: &RawFrame, screen_w: usize, screen_h: usize, fill: u32) {
    let ob = safe_bounds(frame, screen_w, screen_h);
    if ob.width == 0 || ob.height == 0 {
        return;
    }
    for y in 0..ob.height {
        let row = (ob.top + y) * screen_w + ob.left;
        for value in &mut dst[row..row + ob.width] {
            *value = fill;
        }
    }
}

fn erase_data_area_subimage(dst: &mut [u32], subimage: &OptFrame, screen_w: usize, fill: u32) {
    let ob = Bounds {
        left: subimage.left as usize,
        top: subimage.top as usize,
        width: subimage.width as usize,
        height: subimage.height as usize,
    };
    if ob.width == 0 || ob.height == 0 {
        return;
    }
    for y in 0..ob.height {
        let row = (ob.top + y) * screen_w + ob.left;
        for value in &mut dst[row..row + ob.width] {
            *value = fill;
        }
    }
}

fn apply_frame_disposal(
    into_data: &mut [u32],
    from_data: &[u32],
    previous_data: &[u32],
    frame: &RawFrame,
    screen_w: usize,
    screen_h: usize,
    background: u32,
) {
    if frame.dispose == DisposalMethod::Previous {
        into_data.copy_from_slice(previous_data);
    } else {
        into_data.copy_from_slice(from_data);
        if frame.dispose == DisposalMethod::Background {
            erase_data_area(into_data, frame, screen_w, screen_h, background);
        }
    }
}

fn apply_frame(
    dst: &mut [u32],
    screen_w: usize,
    screen_h: usize,
    frame: &RawFrame,
    map: &[u32],
    replace: bool,
) {
    let ob = safe_bounds(frame, screen_w, screen_h);
    if ob.width == 0 || ob.height == 0 {
        return;
    }

    let frame_left = frame.left as usize;
    let frame_top = frame.top as usize;
    let frame_width = frame.width as usize;
    let frame_height = frame.height as usize;
    if frame_width == 0 || frame_height == 0 {
        return;
    }

    let x_start = ob.left.saturating_sub(frame_left);
    let y_start = ob.top.saturating_sub(frame_top);
    let default_map = map.first().copied().unwrap_or(TRANSP);

    for y in 0..ob.height {
        let screen_row = (ob.top + y) * screen_w + ob.left;
        let frame_row = (y_start + y) * frame_width + x_start;
        for x in 0..ob.width {
            let idx = frame.buffer.get(frame_row + x).copied().unwrap_or(0) as usize;
            let mapped = map.get(idx).copied().unwrap_or(default_map);
            if replace || mapped != TRANSP {
                dst[screen_row + x] = mapped;
            }
        }
    }
}

fn find_difference_bounds(
    bounds: &mut OptFrame,
    frame: &RawFrame,
    last_frame: Option<&RawFrame>,
    last_data: &[u32],
    this_data: &[u32],
    screen_w: usize,
    screen_h: usize,
) {
    let (lf_min, rt_max, mut tp, mut bt) = if last_frame
        .map(|f| matches!(f.dispose, DisposalMethod::Any | DisposalMethod::Keep))
        .unwrap_or(true)
    {
        let ob = safe_bounds(frame, screen_w, screen_h);
        let rt = ob.left + ob.width;
        let bt = ob.top + ob.height;
        (ob.left, rt.saturating_sub(1), ob.top, bt.saturating_sub(1))
    } else {
        (0, screen_w.saturating_sub(1), 0, screen_h.saturating_sub(1))
    };

    while tp < screen_h {
        let row = tp * screen_w;
        if last_data[row..row + screen_w] != this_data[row..row + screen_w] {
            break;
        }
        tp += 1;
    }

    while bt >= tp && bt < screen_h {
        let row = bt * screen_w;
        if last_data[row..row + screen_w] != this_data[row..row + screen_w] {
            break;
        }
        if bt == 0 {
            break;
        }
        bt -= 1;
    }

    let mut lf = screen_w;
    let mut rt = 0usize;
    if tp <= bt {
        for y in tp..=bt {
            let row = y * screen_w;
            let ld = &last_data[row..row + screen_w];
            let td = &this_data[row..row + screen_w];
            let mut x = lf_min.min(screen_w);
            while x < lf && x < screen_w && ld[x] == td[x] {
                x += 1;
            }
            lf = lf.min(x);

            let mut x = rt_max.min(screen_w.saturating_sub(1));
            while x > rt && x < screen_w && ld[x] == td[x] {
                if x == 0 {
                    break;
                }
                x -= 1;
            }
            rt = rt.max(x);
        }
    }

    if tp > bt {
        tp = frame.top.min((screen_h.saturating_sub(1)) as u16) as usize;
        bt = tp;
        lf = frame.left.min((screen_w.saturating_sub(1)) as u16) as usize;
        rt = lf;
    }

    bounds.left = lf as u16;
    bounds.top = tp as u16;
    bounds.width = rt.saturating_add(1).saturating_sub(lf) as u16;
    bounds.height = bt.saturating_add(1).saturating_sub(tp) as u16;
}

fn expand_difference_bounds(
    bounds: &mut OptFrame,
    this_bounds: &RawFrame,
    this_data: &[u32],
    next_data: &[u32],
    screen_w: usize,
    screen_h: usize,
    background: u32,
) -> bool {
    let mut ob = safe_bounds(this_bounds, screen_w, screen_h);
    if bounds.width == 0 || bounds.height == 0 {
        bounds.left = 0;
        bounds.top = 0;
        bounds.width = screen_w as u16;
        bounds.height = screen_h as u16;
    }

    let mut expanded = false;
    if ob.left > bounds.left as usize {
        ob.width = (ob.left + ob.width).saturating_sub(bounds.left as usize);
        ob.left = bounds.left as usize;
    }
    if ob.top > bounds.top as usize {
        ob.height = (ob.top + ob.height).saturating_sub(bounds.top as usize);
        ob.top = bounds.top as usize;
    }
    if ob.left + ob.width < bounds.left as usize + bounds.width as usize {
        ob.width = bounds.left as usize + bounds.width as usize - ob.left;
    }
    if ob.top + ob.height < bounds.top as usize + bounds.height as usize {
        ob.height = bounds.top as usize + bounds.height as usize - ob.top;
    }

    while ob.top < bounds.top as usize {
        let row = ob.top * screen_w;
        for x in ob.left..ob.left + ob.width {
            if this_data[row + x] != background && next_data[row + x] == background {
                expanded = true;
                break;
            }
        }
        if expanded {
            break;
        }
        ob.top += 1;
        ob.height = ob.height.saturating_sub(1);
    }

    while ob.top + ob.height > bounds.top as usize + bounds.height as usize {
        let row = (ob.top + ob.height - 1) * screen_w;
        for x in ob.left..ob.left + ob.width {
            if this_data[row + x] != background && next_data[row + x] == background {
                expanded = true;
                break;
            }
        }
        if expanded {
            break;
        }
        ob.height = ob.height.saturating_sub(1);
    }

    while ob.left < bounds.left as usize {
        for y in ob.top..ob.top + ob.height {
            let idx = y * screen_w + ob.left;
            if this_data[idx] != background && next_data[idx] == background {
                expanded = true;
                break;
            }
        }
        if expanded {
            break;
        }
        ob.left += 1;
        ob.width = ob.width.saturating_sub(1);
    }

    while ob.left + ob.width > bounds.left as usize + bounds.width as usize {
        let x = ob.left + ob.width - 1;
        for y in ob.top..ob.top + ob.height {
            let idx = y * screen_w + x;
            if this_data[idx] != background && next_data[idx] == background {
                expanded = true;
                break;
            }
        }
        if expanded {
            break;
        }
        ob.width = ob.width.saturating_sub(1);
    }

    if !expanded {
        for y in ob.top..ob.top + ob.height {
            let row = y * screen_w;
            for x in ob.left..ob.left + ob.width {
                if this_data[row + x] != background && next_data[row + x] == background {
                    expanded = true;
                    break;
                }
            }
            if expanded {
                break;
            }
        }
    }

    bounds.left = ob.left as u16;
    bounds.top = ob.top as u16;
    bounds.width = ob.width as u16;
    bounds.height = ob.height as u16;

    expanded
}

fn get_used_colors(
    bounds: &mut OptFrame,
    mut use_transparency: bool,
    this_data: &[u32],
    last_data: &[u32],
    all_ncol: usize,
    screen_w: usize,
) {
    let mut need = vec![0u8; all_ncol];
    let top = bounds.top as usize;
    let left = bounds.left as usize;
    let width = bounds.width as usize;
    let height = bounds.height as usize;

    for y in top..top + height {
        let row = y * screen_w + left;
        for x in 0..width {
            let idx = row + x;
            let cur = this_data[idx] as usize;
            let last = last_data[idx] as usize;
            if cur != last {
                need[cur] = REQUIRED;
            } else if need[cur] == 0 {
                need[cur] = REPLACE_TRANSP;
            }
        }
    }

    if need[TRANSP as usize] != 0 {
        need[TRANSP as usize] = REQUIRED;
    }

    let mut count = [0usize; 3];
    for &entry in &need {
        count[entry as usize] += 1;
    }

    if use_transparency && count[REQUIRED as usize] < 256 && need[TRANSP as usize] == 0 {
        need[TRANSP as usize] = REQUIRED;
        count[REQUIRED as usize] += 1;
    }

    if count[REPLACE_TRANSP as usize] + count[REQUIRED as usize] > 256 {
        use_transparency = true;
    }

    if count[REPLACE_TRANSP as usize] > 0 && use_transparency && need[TRANSP as usize] == 0 {
        need[TRANSP as usize] = REQUIRED;
        count[REQUIRED as usize] += 1;
    }

    if !use_transparency {
        for entry in &mut need {
            if *entry == REPLACE_TRANSP {
                *entry = REQUIRED;
            }
        }
        count[REQUIRED as usize] += count[REPLACE_TRANSP as usize];
    }

    if use_transparency && count[REQUIRED as usize] < 256 && need[TRANSP as usize] == 0 {
        need[TRANSP as usize] = REQUIRED;
        count[REQUIRED as usize] += 1;
    }

    bounds.required_color_count = count[REQUIRED as usize];
    bounds.needed_colors = need;
}

fn increment_penalties(frame: &OptFrame, penalty: &mut [i32], delta: i32) {
    for (idx, &need) in frame.needed_colors.iter().enumerate().skip(1) {
        if need == REQUIRED {
            penalty[idx] += delta;
        }
    }
}

struct PreparedColormap {
    map: Vec<u8>,
    local_palette: Option<Vec<[u8; 3]>>,
    transparent: Option<u8>,
}

fn prepare_colormap(
    opt: &OptFrame,
    all_colors: &[[u8; 3]],
    all_to_global: &[i16],
    out_global_palette: &[[u8; 3]],
    reserve_transparent: bool,
) -> Option<PreparedColormap> {
    if let Some(result) = prepare_colormap_map(
        opt,
        all_colors,
        all_to_global,
        out_global_palette,
        true,
        reserve_transparent,
    ) {
        return Some(PreparedColormap {
            map: result.map,
            local_palette: None,
            transparent: result.transparent,
        });
    }

    let result = prepare_colormap_map(
        opt,
        all_colors,
        all_to_global,
        out_global_palette,
        false,
        reserve_transparent,
    )?;
    Some(PreparedColormap {
        map: result.map,
        local_palette: Some(result.palette),
        transparent: result.transparent,
    })
}

struct ColormapResult {
    map: Vec<u8>,
    palette: Vec<[u8; 3]>,
    transparent: Option<u8>,
}

fn prepare_colormap_map(
    opt: &OptFrame,
    all_colors: &[[u8; 3]],
    all_to_global: &[i16],
    out_global_palette: &[[u8; 3]],
    is_global: bool,
    reserve_transparent: bool,
) -> Option<ColormapResult> {
    let all_ncol = all_colors.len();
    let mut map = vec![0u8; all_ncol];

    if is_global {
        let mut used = [false; 256];
        let ncol = out_global_palette.len();
        if ncol == 0 {
            return None;
        }

        for i in 1..all_ncol {
            if opt.needed_colors[i] != REQUIRED {
                continue;
            }
            let val = all_to_global[i];
            if val < 0 {
                return None;
            }
            let val = val as usize;
            if val >= ncol {
                return None;
            }
            map[i] = val as u8;
            used[val] = true;
        }

        let transparent = if opt.needed_colors[TRANSP as usize] == REQUIRED {
            let t = if reserve_transparent {
                if used[0] {
                    return None;
                }
                0
            } else {
                let mut idx = None;
                for (i, used) in used.iter().enumerate().take(ncol) {
                    if !*used {
                        idx = Some(i as u8);
                        break;
                    }
                }
                idx?
            };
            map[TRANSP as usize] = t;
            for (i, &need) in opt.needed_colors.iter().enumerate() {
                if need == REPLACE_TRANSP {
                    map[i] = t;
                }
            }
            Some(t)
        } else {
            None
        };

        return Some(ColormapResult {
            map,
            palette: out_global_palette.to_vec(),
            transparent,
        });
    }

    let mut entries: Vec<(u32, usize, [u8; 3])> = Vec::new();
    for (i, color) in all_colors.iter().enumerate().skip(1) {
        if opt.needed_colors[i] == REQUIRED {
            entries.push((rgb_key(*color), i, *color));
        }
    }

    if entries.len() > 256 {
        return None;
    }

    entries.sort_by_key(|(key, _, _)| *key);
    let mut palette = Vec::with_capacity(entries.len());
    let mut used = [false; 256];
    for (new_idx, (_, union_idx, color)) in entries.iter().enumerate() {
        palette.push(*color);
        map[*union_idx] = new_idx as u8;
        used[new_idx] = true;
    }

    let mut transparent = None;
    if opt.needed_colors[TRANSP as usize] == REQUIRED {
        let mut idx = None;
        for (i, used) in used.iter().enumerate().take(palette.len()) {
            if !*used {
                idx = Some(i as u8);
                break;
            }
        }

        if idx.is_none() {
            if palette.len() < 256 {
                idx = Some(palette.len() as u8);
                palette.push(all_colors[TRANSP as usize]);
            } else {
                return None;
            }
        }

        let t = idx.unwrap();
        map[TRANSP as usize] = t;
        for (i, &need) in opt.needed_colors.iter().enumerate() {
            if need == REPLACE_TRANSP {
                map[i] = t;
            }
        }
        transparent = Some(t);
    }

    Some(ColormapResult {
        map,
        palette,
        transparent,
    })
}

fn build_frame_data(this_data: &[u32], map: &[u8], bounds: Bounds, screen_w: usize) -> Vec<u8> {
    let mut output = vec![0u8; bounds.width * bounds.height];
    if bounds.width == 0 || bounds.height == 0 {
        return output;
    }
    let default_map = map.first().copied().unwrap_or(0);
    for y in 0..bounds.height {
        let row = (bounds.top + y) * screen_w + bounds.left;
        let out_row = y * bounds.width;
        for x in 0..bounds.width {
            let union_idx = this_data[row + x] as usize;
            output[out_row + x] = map.get(union_idx).copied().unwrap_or(default_map);
        }
    }
    output
}

fn drop_empty_frames(frames: &mut Vec<Frame<'static>>) {
    if frames.len() < 2 {
        return;
    }
    let mut i = 1;
    while i < frames.len() {
        let is_empty = frames[i].width == 1
            && frames[i].height == 1
            && frames[i].transparent.is_some()
            && frames[i].delay > 0
            && frames[i - 1].delay > 0;
        if is_empty {
            let transparent = frames[i].transparent.unwrap();
            let prev_dispose_ok = matches!(
                frames[i - 1].dispose,
                DisposalMethod::Any | DisposalMethod::Keep
            );
            let dispose_ok = matches!(
                frames[i].dispose,
                DisposalMethod::Any | DisposalMethod::Keep | DisposalMethod::Previous
            );
            if frames[i].buffer.first().copied().unwrap_or(transparent) == transparent
                && prev_dispose_ok
                && dispose_ok
            {
                frames[i - 1].delay = frames[i - 1].delay.saturating_add(frames[i].delay);
                frames.remove(i);
                continue;
            }
        }
        i += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use gif::ColorOutput;
    use std::io::Cursor;

    struct DecodedFrame {
        left: u16,
        top: u16,
        width: u16,
        height: u16,
        dispose: DisposalMethod,
        buffer: Vec<u8>,
    }

    fn encode_gif_test(
        width: u16,
        height: u16,
        global_palette: &[[u8; 3]],
        frames: Vec<Frame<'static>>,
    ) -> Vec<u8> {
        let mut bytes = Vec::new();
        {
            let mut encoder =
                Encoder::new(&mut bytes, width, height, &colors_to_bytes(global_palette)).unwrap();
            encoder.set_repeat(Repeat::Infinite).unwrap();
            for frame in frames {
                encoder.write_frame(&frame).unwrap();
            }
        }
        bytes
    }

    fn decode_rgba_frames(data: &[u8]) -> (u16, u16, Vec<DecodedFrame>) {
        let mut options = DecodeOptions::new();
        options.set_color_output(ColorOutput::RGBA);
        let mut decoder = options.read_info(Cursor::new(data)).unwrap();
        let width = decoder.width();
        let height = decoder.height();
        let mut frames = Vec::new();
        while let Some(frame) = decoder.read_next_frame().unwrap() {
            frames.push(DecodedFrame {
                left: frame.left,
                top: frame.top,
                width: frame.width,
                height: frame.height,
                dispose: frame.dispose,
                buffer: frame.buffer.to_vec(),
            });
        }
        (width, height, frames)
    }

    fn decode_global_palette(data: &[u8]) -> Option<Vec<[u8; 3]>> {
        let mut options = DecodeOptions::new();
        options.set_color_output(ColorOutput::RGBA);
        let decoder = options.read_info(Cursor::new(data)).ok()?;
        let palette = decoder.global_palette()?;
        Some(bytes_to_colors(palette))
    }

    fn render_frames(
        width: u16,
        height: u16,
        frames: &[DecodedFrame],
        background: [u8; 4],
    ) -> Vec<Vec<u8>> {
        let w = width as usize;
        let h = height as usize;
        let mut canvas = vec![0u8; w * h * 4];
        for pixel in canvas.chunks_mut(4) {
            pixel.copy_from_slice(&background);
        }
        let mut previous = Vec::new();
        let mut output = Vec::new();

        for frame in frames {
            if frame.dispose == DisposalMethod::Previous {
                previous = canvas.clone();
            }
            let fw = frame.width as usize;
            let fh = frame.height as usize;
            for y in 0..fh {
                for x in 0..fw {
                    let src = (y * fw + x) * 4;
                    let dst = ((frame.top as usize + y) * w + (frame.left as usize + x)) * 4;
                    let alpha = frame.buffer[src + 3];
                    if alpha == 0 {
                        continue;
                    }
                    canvas[dst..dst + 4].copy_from_slice(&frame.buffer[src..src + 4]);
                }
            }
            output.push(canvas.clone());
            match frame.dispose {
                DisposalMethod::Background => {
                    for y in 0..fh {
                        for x in 0..fw {
                            let dst =
                                ((frame.top as usize + y) * w + (frame.left as usize + x)) * 4;
                            canvas[dst..dst + 4].copy_from_slice(&background);
                        }
                    }
                }
                DisposalMethod::Previous => {
                    canvas = previous.clone();
                }
                _ => {}
            }
        }

        output
    }

    #[test]
    fn lossless_preserves_last_disposal() {
        let palette = [[0, 0, 0], [255, 0, 0], [0, 0, 255]];
        let mut first = Frame::default();
        first.width = 2;
        first.height = 2;
        first.delay = 10;
        first.transparent = Some(0);
        first.dispose = DisposalMethod::Any;
        first.buffer = Cow::Owned(vec![1, 0, 0, 0]);

        let mut last = Frame::default();
        last.width = 2;
        last.height = 2;
        last.delay = 10;
        last.transparent = Some(0);
        last.dispose = DisposalMethod::Previous;
        last.buffer = Cow::Owned(vec![0, 2, 0, 0]);

        let input = encode_gif_test(2, 2, &palette, vec![first, last]);
        let output = compress_gif_lossless(&input).expect("lossless gif encodes");
        let (_, _, out_frames) = decode_rgba_frames(&output);
        assert_eq!(out_frames.last().unwrap().dispose, DisposalMethod::Previous);
    }

    #[test]
    fn lossless_preserves_transparent_background_index() {
        let palette = [[0, 0, 0], [255, 0, 0]];
        let mut frame1 = Frame::default();
        frame1.width = 2;
        frame1.height = 2;
        frame1.delay = 10;
        frame1.transparent = Some(0);
        frame1.dispose = DisposalMethod::Background;
        frame1.buffer = Cow::Owned(vec![1, 0, 0, 0]);

        let mut frame2 = Frame::default();
        frame2.width = 2;
        frame2.height = 2;
        frame2.delay = 10;
        frame2.transparent = Some(0);
        frame2.dispose = DisposalMethod::Any;
        frame2.buffer = Cow::Owned(vec![0, 0, 0, 0]);

        let input = encode_gif_test(2, 2, &palette, vec![frame1, frame2]);
        let output = compress_gif_lossless(&input).expect("lossless gif encodes");

        let (in_w, in_h, in_frames) = decode_rgba_frames(&input);
        let (out_w, out_h, out_frames) = decode_rgba_frames(&output);
        assert_eq!((in_w, in_h), (out_w, out_h));

        let out_palette = decode_global_palette(&output).expect("global palette exists");
        assert_eq!(out_palette.first().copied(), Some(palette[0]));

        let background = [0, 0, 0, 0];
        let rendered_in = render_frames(in_w, in_h, &in_frames, background);
        let rendered_out = render_frames(out_w, out_h, &out_frames, background);
        assert_eq!(rendered_in, rendered_out);
    }

    #[test]
    fn lossless_keeps_background_disposal_clear() {
        let palette = [[0, 0, 0], [255, 0, 0]];
        let mut frame1 = Frame::default();
        frame1.width = 2;
        frame1.height = 2;
        frame1.delay = 10;
        frame1.transparent = Some(0);
        frame1.dispose = DisposalMethod::Keep;
        frame1.buffer = Cow::Owned(vec![1, 0, 0, 0]);

        let mut frame2 = Frame::default();
        frame2.width = 1;
        frame2.height = 1;
        frame2.left = 0;
        frame2.top = 0;
        frame2.delay = 10;
        frame2.transparent = Some(0);
        frame2.dispose = DisposalMethod::Background;
        frame2.buffer = Cow::Owned(vec![0]);

        let input = encode_gif_test(2, 2, &palette, vec![frame1, frame2]);
        let output = compress_gif_lossless(&input).expect("lossless gif encodes");

        let (in_w, in_h, in_frames) = decode_rgba_frames(&input);
        let (out_w, out_h, out_frames) = decode_rgba_frames(&output);
        assert_eq!((in_w, in_h), (out_w, out_h));

        let background = [0, 0, 0, 0];
        let rendered_in = render_frames(in_w, in_h, &in_frames, background);
        let rendered_out = render_frames(out_w, out_h, &out_frames, background);
        assert_eq!(rendered_in, rendered_out);
    }
}
