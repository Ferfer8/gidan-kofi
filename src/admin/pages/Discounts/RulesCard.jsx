// RulesCard: the card with the manager discount rules (highest %, reason required), used by the Discounts page.

import { useState } from 'react';
import Card from '../../../shared/components/Card.jsx';
import Button from '../../../shared/components/Button.jsx';
import Toggle from '../../../shared/components/Toggle.jsx';
import AffixInput from '../../../shared/components/AffixInput.jsx';
import { managerRules } from '../../data/discounts.js';

// A percentage input is valid when it is a whole number from 1 to 100
const isValidPercent = (value) => Number.isInteger(value) && value >= 1 && value <= 100;

function RulesCard() {
  const [savedRules, setSavedRules] = useState(managerRules);
  const [rules, setRules] = useState(managerRules);

  function updateRule(field, value) {
    setRules({ ...rules, [field]: value });
  }

  // typing keeps '' while the box is empty, otherwise a number
  const toNumber = (text) => (text === '' ? '' : Number(text));

  const hasChanged = JSON.stringify(rules) !== JSON.stringify(savedRules);
  const maxIsValid = isValidPercent(rules.maxManualPercent);
  const emailIsValid = !rules.emailOwner || isValidPercent(rules.emailAbovePercent);

  return (
    <Card
      className="rules_card"
      title="Manager discount rules"
      action={
        hasChanged && (
          <Button
            className="button_small"
            disabled={!maxIsValid || !emailIsValid}
            onClick={() => setSavedRules(rules)}
          >
            Save rules
          </Button>
        )
      }
    >
      <p className="rules_subtitle">For discounts typed in by a manager with their PIN, without a code</p>

      <ul className="rules_list">
        <li className="rule_row">
          <div>
            <p className="rule_title">Highest manual discount</p>
            <p className="rule_hint">Managers can't give more than this without the owner</p>
          </div>
          <AffixInput
            className="rule_input"
            value={rules.maxManualPercent}
            suffix="%"
            min="1"
            max="100"
            invalid={!maxIsValid}
            aria-label="Highest manual discount percent"
            onChange={(value) => updateRule('maxManualPercent', toNumber(value))}
          />
        </li>

        <li className="rule_row">
          <div>
            <p className="rule_title">Reason required</p>
            <p className="rule_hint">Staff, complaint, damaged item or other, saved with the order</p>
          </div>
          <Toggle
            checked={rules.reasonRequired}
            onChange={(value) => updateRule('reasonRequired', value)}
            label="Reason required"
          />
        </li>

        <li className="rule_row">
          <div>
            <p className="rule_title">Email above</p>
            <p className="rule_hint">Sends an alert for large manual discounts</p>
          </div>
          <div className="rule_controls">
            <AffixInput
              className="rule_input"
              value={rules.emailAbovePercent}
              suffix="%"
              min="1"
              max="100"
              disabled={!rules.emailOwner}
              invalid={!emailIsValid}
              aria-label="Email above this percent"
              onChange={(value) => updateRule('emailAbovePercent', toNumber(value))}
            />
            <Toggle
              checked={rules.emailOwner}
              onChange={(value) => updateRule('emailOwner', value)}
              label="Email above"
            />
          </div>
        </li>
      </ul>
    </Card>
  );
}

export default RulesCard;
