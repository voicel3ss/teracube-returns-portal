import Image from "next/image";
import Link from "next/link";

export function BrandHeader({ quietLabel }: { quietLabel?: string }) {
  return (
    <header className="border-b border-black/10 border-t-[3px] border-t-[var(--green)] bg-white">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-6">
        <Link href="/" className="flex items-center" aria-label="Teracube Device Care home">
          <Image
            src="/brand/teracube-logo.png"
            alt="Teracube"
            width={200}
            height={200}
            priority
            className="size-[4.25rem] object-contain"
          />
          <div className="ml-3 border-l border-black/15 pl-3">
            <p className="text-sm font-semibold tracking-[-0.01em] text-black/75">Device Care</p>
            <p className="mt-0.5 hidden text-xs text-black/45 sm:block">Repairs &amp; replacements</p>
          </div>
        </Link>
        {quietLabel ? <p className="text-xs font-medium text-black/45 sm:text-sm">{quietLabel}</p> : null}
      </div>
    </header>
  );
}
