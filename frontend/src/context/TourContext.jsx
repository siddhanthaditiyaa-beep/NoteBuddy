import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const TourContext = createContext(null);

// Each step highlights a real element on a real page — the tour navigates
// the person there and lets them click it directly, rather than just
// describing it in a floating modal.
const STEPS = [
  {
    route: "/dashboard",
    selector: "[data-tour='new-note-btn']",
    title: "Start here",
    body: 'Click "New Note" any time you want to turn material into a study kit. Let\'s see how it works.',
  },
  {
    route: "/upload",
    selector: "[data-tour='mode-toggle']",
    title: "Add your material",
    body: "Paste text directly, or switch here to upload a PDF or a photo of handwritten notes.",
  },
  {
    route: "/upload",
    selector: "[data-tour='example-chips']",
    title: "No notes handy?",
    body: "Click one of these to instantly load an example — great for a quick test run.",
  },
  {
    route: "/upload",
    selector: "[data-tour='level-slider']",
    title: "Pick an explanation level",
    body: "NoteBuddy adjusts its language for you — from kid-friendly to full student-level detail.",
  },
  {
    route: "/upload",
    selector: "[data-tour='generate-btn']",
    title: "Generate your study kit",
    body: "Click this and NoteBuddy's AI builds your summary, flashcards, and quiz. Try it now — the tour ends here so you can explore freely!",
    isLast: true,
  },
];

export function TourProvider({ children }) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  const goToStep = useCallback(
    (index) => {
      const step = STEPS[index];
      if (!step) return;
      setStepIndex(index);
      if (location.pathname !== step.route) navigate(step.route);
    },
    [navigate, location.pathname]
  );

  const start = useCallback(() => {
    setStepIndex(0);
    setActive(true);
    if (location.pathname !== STEPS[0].route) navigate(STEPS[0].route);
  }, [navigate, location.pathname]);

  const next = useCallback(() => {
    if (stepIndex + 1 >= STEPS.length) {
      setActive(false);
      return;
    }
    goToStep(stepIndex + 1);
  }, [stepIndex, goToStep]);

  const back = useCallback(() => {
    if (stepIndex === 0) return;
    goToStep(stepIndex - 1);
  }, [stepIndex, goToStep]);

  const skip = useCallback(() => setActive(false), []);

  // Memoized so the context value only changes identity when something the
  // consumer actually cares about changes — otherwise every re-render
  // (e.g. from the route change the tour itself triggers) hands out a new
  // object, and a consumer effect that depends on it fires again, which
  // was restarting the tour right after Skip was clicked.
  const value = useMemo(
    () => ({
      active,
      step: STEPS[stepIndex],
      stepIndex,
      total: STEPS.length,
      start,
      next,
      back,
      skip,
    }),
    [active, stepIndex, start, next, back, skip]
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  return useContext(TourContext);
}
