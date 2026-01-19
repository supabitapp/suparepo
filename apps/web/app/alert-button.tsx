"use client";

import { Button } from "@repo/ui/components/ui/button";

export function AlertButton() {
  return <Button onClick={() => alert("Hello from web!")}>Open alert</Button>;
}
