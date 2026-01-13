import { useTheme } from "@/hooks/useTheme";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      expand={true}
      richColors
      visibleToasts={3}
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:backdrop-blur-xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:bg-card group-[.toaster]:text-primary group-[.toaster]:border-primary/30",
          error: "group-[.toaster]:bg-card group-[.toaster]:text-destructive group-[.toaster]:border-destructive/30",
          info: "group-[.toaster]:bg-card group-[.toaster]:text-[hsl(var(--terminal-cyan))] group-[.toaster]:border-[hsl(var(--terminal-cyan))]/30",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };