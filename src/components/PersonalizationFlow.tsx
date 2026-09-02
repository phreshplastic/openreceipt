import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { WordmarkPicker } from "./WordmarkPicker";
import {
  printerIdentities,
  useCases,
  type PrinterIdentityId,
  type PrinterProfile,
  type UseCaseId,
} from "../onboarding/profile";

type Props = {
  profile: PrinterProfile;
  onComplete(profile: PrinterProfile): void;
  onClose(): void;
};

export function PersonalizationFlow({ profile, onComplete, onClose }: Props) {
  const modalRef = useRef<HTMLElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [firstName, setFirstName] = useState(profile.ownerFirstName);
  const [identityId, setIdentityId] = useState<PrinterIdentityId>(profile.identityId);
  const [selectedUseCases, setSelectedUseCases] = useState<UseCaseId[]>(profile.useCaseIds);
  const identity = printerIdentities.find((item) => item.id === identityId) ?? printerIdentities[0];
  const nameMissing = identity.requiresFirstName && !firstName.trim();

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    modalRef.current?.querySelector<HTMLElement>("input, button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = [...modalRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, [onClose]);

  const save = (useCaseIds: UseCaseId[]) => onComplete({
    completed: true,
    ownerFirstName: firstName.trim(),
    identityId,
    useCaseIds,
  });

  const toggleUseCase = (id: UseCaseId) => setSelectedUseCases((current) => current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current, id]);

  return <div className="personalization-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={modalRef} className="personalization-flow" role="dialog" aria-modal="true" aria-labelledby="personalization-title">
      <header className="personalization-header">
        <span>{step} of 2</span>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close personalization"><X size={17} /></button>
      </header>

      {step === 1 ? <div className="personalization-step">
        <h2 id="personalization-title">Name your printer</h2>
        <p>Choose a sign. The paper will use it; you can change it later.</p>
        <label className="personalization-name">
          <span>First name</span>
          <input value={firstName} maxLength={40} autoComplete="given-name" placeholder="Pete" onChange={(event) => setFirstName(event.target.value)} />
        </label>
        <WordmarkPicker selected={identityId} firstName={firstName} onSelect={setIdentityId} />
        {nameMissing && <p className="personalization-validation">Add your first name to set the mark.</p>}
      </div> : <div className="personalization-step">
        <h2 id="personalization-title">What will you put on paper?</h2>
        <p>Pick any that sound useful. Those blocks stay close in the library.</p>
        <div className="use-case-grid">
          {useCases.map((item) => {
            const selected = selectedUseCases.includes(item.id);
            return <button type="button" aria-pressed={selected} className={selected ? "selected" : ""} key={item.id} onClick={() => toggleUseCase(item.id)}>
              <span>{selected && <Check size={14} />}</span>
              <strong>{item.name}</strong>
              <small>{item.description}</small>
            </button>;
          })}
        </div>
      </div>}

      <footer className="personalization-actions">
        {step === 1
          ? <><button type="button" className="text-button" onClick={onClose}>Skip for now</button><button type="button" className="button primary" disabled={nameMissing} onClick={() => setStep(2)}>Continue</button></>
          : <><button type="button" className="text-button" onClick={() => setStep(1)}>Back</button><div><button type="button" className="text-button" onClick={() => save([])}>Skip</button><button type="button" className="button primary" onClick={() => save(selectedUseCases)}>Done</button></div></>}
      </footer>
    </section>
  </div>;
}
