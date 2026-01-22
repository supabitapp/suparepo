import { Button } from "@repo/ui/components/ui/button";
import { Apple } from "@repo/ui/icons/lucide";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold">supacode</h1>
      <a href="https://supacode.sh/download/latest/supacode.dmg">
        <Button size="lg" className="cursor-pointer gap-2 text-xs uppercase tracking-wider">
          <Apple className="size-4" />
          Download for macOS
        </Button>
      </a>
    </main>
  );
}
