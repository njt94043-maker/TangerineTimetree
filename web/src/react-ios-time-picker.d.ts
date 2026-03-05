declare module 'react-ios-time-picker' {
  import { FC } from 'react';
  interface TimePickerProps {
    value?: string;
    onChange?: (value: string) => void;
    pickerDefaultValue?: string;
    height?: number;
    width?: number | string;
  }
  export const TimePicker: FC<TimePickerProps>;
}
