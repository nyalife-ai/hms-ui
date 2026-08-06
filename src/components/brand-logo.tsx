import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  /** Display height in px; width scales with the 480×230 source. */
  height?: number;
  priority?: boolean;
};

export function BrandLogo({
  className = "",
  height = 40,
  priority = false,
}: BrandLogoProps) {
  const width = Math.round((height * 480) / 230);
  return (
    <Image
      src="/logo-transparent.png"
      alt="NyaLife Women's Health Clinic"
      width={width}
      height={height}
      className={`object-contain ${className}`}
      priority={priority}
    />
  );
}
