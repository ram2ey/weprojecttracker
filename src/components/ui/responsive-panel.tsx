"use client";

import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { Menu, SlidersHorizontal, X } from "lucide-react";

function subscribe(callback: () => void) {
  const query = window.matchMedia("(max-width: 800px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
export function ResponsivePanel({
  children,
  title,
  kind = "filters",
  mobileBrand,
}: {
  children: ReactNode;
  title: string;
  kind?: "filters" | "navigation" | "staff";
  mobileBrand?: ReactNode;
}) {
  const mobile = useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(max-width: 800px)").matches,
    () => false,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const requested = useRef(false);
  const previousOverflow = useRef("");
  const ownsScrollLock = useRef(false);
  const animation = useRef<ReturnType<typeof animate> | null>(null);
  const gesture = useRef<{
    start: number;
    position: number;
    time: number;
    velocity: number;
  } | null>(null);
  const y = useMotionValue(0);
  const reduce = useReducedMotion();
  const id = useId();
  useEffect(
    () => () => {
      animation.current?.stop();
      if (ownsScrollLock.current)
        document.body.style.overflow = previousOverflow.current;
      ownsScrollLock.current = false;
      requested.current = false;
    },
    [mobile],
  );
  function open() {
    animation.current?.stop();
    if (!dialog.current?.open) {
      previousOverflow.current = document.body.style.overflow;
      dialog.current?.showModal();
      document.body.style.overflow = "hidden";
      ownsScrollLock.current = true;
      y.set(reduce ? 0 : 80);
    }
    requested.current = true;
    animation.current = animate(y, 0, {
      type: "spring",
      bounce: 0,
      duration: reduce ? 0 : 0.35,
    });
  }
  function close(velocity = 0) {
    requested.current = false;
    animation.current?.stop();
    animation.current = animate(y, reduce ? 0 : window.innerHeight, {
      type: "spring",
      bounce: 0,
      duration: reduce ? 0 : 0.35,
      velocity,
      onComplete: () => {
        if (!requested.current) {
          dialog.current?.close();
          document.body.style.overflow = previousOverflow.current;
          ownsScrollLock.current = false;
          trigger.current?.focus();
        }
      },
    });
  }
  if (!mobile) return kind === "navigation" ? null : <>{children}</>;
  const Icon = kind === "filters" ? SlidersHorizontal : Menu;
  return (
    <div className={`responsive-panel responsive-panel-${kind}`}>
      {mobileBrand}
      <button
        ref={trigger}
        type="button"
        className="button button-outline panel-trigger"
        onClick={open}
        aria-haspopup="dialog"
        aria-label={kind === "navigation" ? "Open navigation" : title}
      >
        <Icon size={18} />
        <span>{title}</span>
      </button>
      <dialog
        ref={dialog}
        className="native-sheet"
        aria-labelledby={id}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const items = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
            ),
          ).filter((element) => element.getClientRects().length > 0);
          const first = items[0],
            last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <motion.div className="sheet-surface" style={{ y }}>
          <div
            className="sheet-handle"
            aria-hidden="true"
            onPointerDown={(event) => {
              animation.current?.stop();
              event.currentTarget.setPointerCapture(event.pointerId);
              gesture.current = {
                start: event.clientY - y.get(),
                position: event.clientY,
                time: event.timeStamp,
                velocity: 0,
              };
            }}
            onPointerMove={(event) => {
              const drag = gesture.current;
              if (!drag) return;
              const elapsed = event.timeStamp - drag.time;
              if (elapsed > 0)
                drag.velocity =
                  ((event.clientY - drag.position) / elapsed) * 1000;
              drag.position = event.clientY;
              drag.time = event.timeStamp;
              const offset = event.clientY - drag.start;
              y.set(offset < 0 ? offset / (1 + Math.abs(offset) / 60) : offset);
            }}
            onPointerUp={(event) => {
              const drag = gesture.current;
              gesture.current = null;
              if (!drag) return;
              const velocity =
                event.timeStamp - drag.time > 100 ? 0 : drag.velocity;
              const projected =
                y.get() + ((velocity / 1000) * 0.998) / (1 - 0.998);
              if (projected > 180) close(velocity);
              else
                animation.current = animate(y, 0, {
                  type: "spring",
                  bounce: reduce ? 0 : 0.15,
                  duration: reduce ? 0 : 0.35,
                  velocity,
                });
            }}
            onPointerCancel={() => {
              gesture.current = null;
              animation.current = animate(y, 0, {
                type: "spring",
                bounce: 0,
                duration: reduce ? 0 : 0.35,
              });
            }}
          >
            <span />
          </div>
          <header className="sheet-heading">
            <h2 id={id}>{title}</h2>
            <button
              type="button"
              className="button button-ghost button-icon"
              aria-label={`Close ${title.toLowerCase()}`}
              onClick={() => close()}
            >
              <X size={20} />
            </button>
          </header>
          <div
            className="sheet-content"
            onClick={(event) => {
              if (
                kind !== "filters" &&
                (event.target as HTMLElement).closest("a")
              )
                close();
            }}
          >
            {children}
          </div>
        </motion.div>
      </dialog>
    </div>
  );
}
