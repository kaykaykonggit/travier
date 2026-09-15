import { forwardRef, type ElementType, type HTMLAttributes, type ReactNode } from "react";

type SurfaceCardProps = {
  as?: ElementType;
  className?: string;
  children?: ReactNode;
} & HTMLAttributes<HTMLElement>;

/** Soft card shell for non-sticky content (map, timeline). Sticky chrome/tabs stay bare. */
export const SurfaceCard = forwardRef<HTMLElement, SurfaceCardProps>(function SurfaceCard(
  { as, className, children, ...rest },
  ref,
) {
  const Tag = (as ?? "div") as ElementType;
  return (
    <Tag ref={ref} className={["surface-card", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </Tag>
  );
});
