#!/bin/bash
set -e
cd "$(dirname "$0")/.."

BASELINE_FILE="scripts/benchmark-baseline.json"
TOLERANCE=2.0

cargo build --manifest-path apps/supaimg-desktop/src-tauri/Cargo.toml --bin bench --release >&2

results="["
first=true
failed=0
total_files=0

for format in gif jpeg png webp; do
    format_count=0
    dirs=(
        "apps/supaimg-desktop/src-tauri/test_assets/$format"
        "apps/supaimg-desktop/src-tauri/bench_assets/$format"
    )

    for dir in "${dirs[@]}"; do
        [ -d "$dir" ] || continue

        if [[ "$dir" == *"/test_assets/"* ]]; then
            source="test"
        else
            source="bench"
        fi

        while IFS= read -r line; do
            case "$line" in
                "compressed "*)
                    ;;
                *)
                    continue
                    ;;
            esac

            if [[ "$line" != *" -> "* ]]; then
                continue
            fi

            file=$(echo "$line" | sed 's/compressed \(.*\) (.*/\1/' | xargs basename)
            before=$(echo "$line" | sed 's/.*(\([0-9]*\) -> .*/\1/')
            after=$(echo "$line" | sed 's/.* -> \([0-9]*\)).*/\1/')

            case "$before" in
                ''|*[!0-9]*) continue ;;
            esac

            case "$after" in
                ''|*[!0-9]*) continue ;;
            esac

            if [ "$before" -eq 0 ]; then
                continue
            fi

            format_count=$((format_count + 1))
            total_files=$((total_files + 1))

            saved_pct=$(awk "BEGIN {printf \"%.1f\", (1 - $after/$before) * 100}")
            before_kb=$(awk "BEGIN {printf \"%.2f\", $before/1024}")
            after_kb=$(awk "BEGIN {printf \"%.2f\", $after/1024}")

            if [ "$source" = "test" ]; then
                key="$format/$file"
            else
                key="bench/$format/$file"
            fi
            baseline_pct=$(jq -r --arg k "$key" '.[$k] // empty' "$BASELINE_FILE")

            status="pass"
            if [ -n "$baseline_pct" ]; then
                min_allowed=$(awk "BEGIN {printf \"%.1f\", $baseline_pct - $TOLERANCE}")
                if [ "$(awk "BEGIN {print ($saved_pct < $min_allowed) ? 1 : 0}")" -eq 1 ]; then
                    status="fail"
                    failed=1
                    echo "REGRESSION: $key saved ${saved_pct}% (baseline: ${baseline_pct}%, min: ${min_allowed}%)" >&2
                fi
            fi

            if [ "$first" = true ]; then
                first=false
            else
                results+=","
            fi

            results+="{\"format\":\"$format\",\"file\":\"$file\",\"before_kb\":$before_kb,\"after_kb\":$after_kb,\"saved_pct\":$saved_pct,\"status\":\"$status\"}"
        done < <(./apps/supaimg-desktop/src-tauri/target/release/bench --preset lossless --no-write "$dir"/* 2>&1)
    done

    if [ "$format_count" -eq 0 ]; then
        echo "FAIL: no files compressed for $format" >&2
        failed=1
    fi
done

results+="]"

if [ "$total_files" -eq 0 ]; then
    echo "FAIL: no files compressed at all" >&2
    exit 1
fi

echo "$results"
exit $failed
