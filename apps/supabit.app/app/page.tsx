import Image from "next/image";
import Link from "next/link";
import { FileIcon, FileTextIcon, ImageIcon } from "@repo/ui/icons/lucide";
import { Separator } from "@repo/ui/components/ui/separator";

const team = [
  {
    name: "khoi",
    job: "Founder",
    href: "https://twitter.com/khoi",
    avatar: "/avatars/khoi.png",
  },
  {
    name: "Quan",
    job: "Principal Engineer",
    href: "#",
    avatar: "/avatars/quan.png",
  },
];

const projects = [
  {
    name: "SupaMD",
    href: "https://supamd.app",
    description: "A collaborative real time sync scratch pad",
    icon: FileTextIcon,
  },
  {
    name: "SupaIMG",
    href: "https://supaimg.app",
    description: "A local Swiss Army Knife For Your Images",
    icon: ImageIcon,
  },
  {
    name: "Supacode",
    href: "https://supacode.app",
    description: "A local AI coding companion - Coming soon",
    icon: FileIcon,
  },
  {
    name: "SupaPDF",
    href: "https://supapdf.app",
    description: "A local PDF toolbox - Coming soon",
    icon: FileIcon,
  },
];

function SectionSeparator({ label }: { label: string }) {
  return (
    <div className="relative my-8">
      <Separator />
      <span className="absolute -top-3 left-0 bg-background px-2 text-lg font-semibold uppercase text-foreground">
        {label}
      </span>
    </div>
  );
}

export default function Home() {
  return (
    <div className="mx-auto max-w-2xl p-4 text-muted-foreground sm:p-6">
      <section className="space-y-4">
        <h1 className="mt-4 text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
          Supabit
        </h1>
        <p className="leading-relaxed">
          We are a small team of engineers who are passionate about building truly great products.
        </p>
      </section>

      <SectionSeparator label="Team" />

      <div className="mb-12 grid grid-cols-1 gap-y-6">
        {team.map(({ name, job, href, avatar }) => (
          <Link key={name} href={href} className="group flex items-start space-x-4">
            <div className="shrink-0">
              <Image
                src={avatar}
                alt={name}
                width={48}
                height={48}
                className="rounded-full object-cover"
              />
            </div>
            <div>
              <div className="text-foreground font-semibold uppercase group-hover:underline">
                {name}
              </div>
              <div className="text-sm text-muted-foreground">{job}</div>
            </div>
          </Link>
        ))}
      </div>

      <SectionSeparator label="Projects" />

      <div className="mb-12 grid grid-cols-1 gap-y-6">
        {projects.map(({ name, href, description, icon: Icon }) => (
          <Link key={name} href={href} className="group flex items-start gap-3">
            <Icon className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="space-y-1">
              <div className="text-foreground font-semibold uppercase group-hover:underline">
                {name}
              </div>
              <div className="text-sm text-muted-foreground">{description}</div>
            </div>
          </Link>
        ))}
      </div>

      <SectionSeparator label="Contacts" />

      <footer className="mb-24 space-y-2">
        <p>
          We&apos;d love to hear from you.{" "}
          <a
            href="mailto:hi@supabit.app"
            className="text-primary hover:underline whitespace-nowrap"
          >
            Say hi, we don&apos;t bite.
          </a>
        </p>
        <p className="text-muted-foreground/70">&copy; Supabit</p>
      </footer>
    </div>
  );
}
