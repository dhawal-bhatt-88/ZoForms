import { Callout } from "@/components/ui";

/*
 * The docs' three callouts, on the kit's Callout. The word is the title, so
 * the kind never rests on colour alone:
 *   - Note: a limit of the product, something it doesn't do.
 *   - Tip: a better way to do what the page describes.
 *   - Warning: something that loses work or data if missed.
 */

type Props = { children?: React.ReactNode };

export const Note = ({ children }: Props) => (
  <Callout tone="info" title="Note" className="my-5">
    {children}
  </Callout>
);

export const Tip = ({ children }: Props) => (
  <Callout tone="pass" title="Tip" className="my-5">
    {children}
  </Callout>
);

export const Warning = ({ children }: Props) => (
  <Callout tone="warn" title="Warning" className="my-5">
    {children}
  </Callout>
);
