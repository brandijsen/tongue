import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Extra classes on the outer shell (horizontal padding is fixed here). */
  shellClassName?: string;
  /** Extra classes on the inner centered column. */
  columnClassName?: string;
};

/** Shared chat content width: same lateral margin and max width as the composer. */
export function ChatColumn({ children, shellClassName = "", columnClassName = "" }: Props) {
  return (
    <div className={`w-full px-4 sm:px-6 ${shellClassName}`.trim()}>
      <div className={`mx-auto w-full max-w-3xl ${columnClassName}`.trim()}>{children}</div>
    </div>
  );
}
