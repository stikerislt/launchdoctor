import { useCallback, useState } from "react";
import { BlockStack, Button, DatePicker, Popover, TextField } from "@shopify/polaris";

type Props = {
  name: string;
  label?: string;
  helpText?: string;
  disabled?: boolean;
};

/**
 * Polaris DatePicker inside a Popover — native `<input type="date">` popups often
 * fail inside the Shopify admin embedded iframe (opens but day clicks do nothing).
 */
export function AdminDatePicker({
  name,
  label = "End date (optional)",
  helpText,
  disabled,
}: Props) {
  const [popoverActive, setPopoverActive] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [{ month, year }, setMonthYear] = useState(() => {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  });

  const handleMonthChange = useCallback((newMonth: number, newYear: number) => {
    setMonthYear({ month: newMonth, year: newYear });
  }, []);

  const handleDateChange = useCallback(({ start }: { start: Date }) => {
    setSelectedDate(start);
    setPopoverActive(false);
  }, []);

  const formattedValue = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
    : "";

  return (
    <BlockStack gap="100">
      <input type="hidden" name={name} value={formattedValue} />
      <Popover
        active={popoverActive}
        autofocusTarget="none"
        preferredAlignment="left"
        onClose={() => setPopoverActive(false)}
        activator={
          <TextField
            label={label}
            value={formattedValue}
            onFocus={() => !disabled && setPopoverActive(true)}
            onChange={() => {}}
            placeholder="Pick a date or leave empty"
            autoComplete="off"
            disabled={disabled}
            connectedRight={
              selectedDate ? (
                <Button disabled={disabled} onClick={() => setSelectedDate(undefined)}>
                  Clear
                </Button>
              ) : undefined
            }
          />
        }
      >
        <DatePicker
          month={month}
          year={year}
          onChange={handleDateChange}
          onMonthChange={handleMonthChange}
          selected={selectedDate}
        />
      </Popover>
      {helpText ? <p className="ld-admin-date-help">{helpText}</p> : null}
    </BlockStack>
  );
}
