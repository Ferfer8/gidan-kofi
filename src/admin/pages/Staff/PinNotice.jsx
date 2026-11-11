// PinNotice: shows a newly generated PIN once, used by StaffModal and ResetPinModal.

// Shows a newly generated PIN once. onGenerate (optional) adds a "Generate new" link.
function PinNotice({ intro, pin, onGenerate }) {
  return (
    <div className="pin_notice">
      <p>{intro}</p>
      <p className="pin_digits">{pin}</p>
      <p className="pin_hint">Write it down and give it to them; you won't see it again.</p>
      {onGenerate && (
        <button type="button" className="link_button" onClick={onGenerate}>
          Generate new
        </button>
      )}
    </div>
  );
}

export default PinNotice;
