// FormField: a label with its input, select or textarea, used in the admin forms.

import './FormField.css';

// Label + control. Style the control with the form_input class (input, select, textarea).
function FormField({ label, htmlFor, children }) {
  return (
    <div className="form_field">
      <label className="form_label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default FormField;
