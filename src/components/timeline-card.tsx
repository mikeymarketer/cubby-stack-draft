import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface TimelineCardProps {
  id: string;
  title: string;
  createdAt: string;
  compact?: boolean;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const currentYear = new Date().getFullYear();
  if (date.getFullYear() === currentYear) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function TimelineCard({
  id,
  title,
  createdAt,
  compact = false,
  isSelected = false,
  onClick,
  onContextMenu,
}: TimelineCardProps) {
  const footerHeight = compact ? 56 : 64;

  const cardWrapperClass = cn(
    "group flex flex-col items-start transition-transform hover:scale-[1.02] w-full min-w-0",
    isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-xl"
  );

  const content = (
    <>
      {/* Folder thumbnail */}
      <div className="block relative w-full overflow-hidden p-0 m-0">
        <Image
          src="/assets/project-folder.svg"
          alt="Timeline folder"
          width={200}
          height={160}
          className="drop-shadow-md"
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            objectFit: "contain",
            objectPosition: "top center",
          }}
          draggable={false}
          priority={false}
        />
      </div>

      {/* Footer */}
      <div
        className={cn("bg-card rounded-b-xl shadow-sm relative overflow-hidden", compact ? "px-3" : "px-4")}
        style={{
          width: "100%",
          height: footerHeight,
          paddingTop: 10,
          paddingBottom: 14,
          boxSizing: "border-box",
        }}
      >
        <div className="flex items-start justify-between gap-2 h-full">
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className={cn("font-medium truncate text-foreground text-left", compact ? "text-sm" : "text-base")}>
              {title}
            </p>
            <p className={cn("text-muted-foreground text-left truncate mt-0.5", compact ? "text-xs" : "text-sm")}>
              {formatDate(createdAt)}
            </p>
          </div>
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <div
        className={cardWrapperClass}
        style={{ cursor: "pointer" }}
        onClick={onClick}
        onContextMenu={onContextMenu}
        data-timeline-id={id}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={`/projects/${id}`}
      className={cardWrapperClass}
      onContextMenu={onContextMenu}
      data-timeline-id={id}
    >
      {content}
    </Link>
  );
}
