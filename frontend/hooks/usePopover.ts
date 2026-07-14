import { useCallback, useState } from "react";

type Placement = "bottom" | "top";

/**
 * Keeps a popover on-screen by deciding whether to open below or above its
 * trigger based on available viewport space. Call `measure(triggerEl)` when
 * opening; read `placement` to position the panel.
 */
export function usePopover() {
  const [placement, setPlacement] = useState<Placement>("bottom");

  const measure = useCallback((trigger: HTMLElement | null, estHeight = 300) => {
    if (!trigger) {
      setPlacement("bottom");
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    const above = rect.top;
    setPlacement(below < estHeight && above > below ? "top" : "bottom");
  }, []);

  return { placement, measure };
}
