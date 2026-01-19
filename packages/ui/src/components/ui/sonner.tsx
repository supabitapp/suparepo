import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    theme="system"
    className="toaster group"
    position="bottom-right"
    duration={4200}
    gap={12}
    visibleToasts={4}
    offset={{ bottom: 80, right: 24 }}
    {...props}
  />
);

export { Toaster };
