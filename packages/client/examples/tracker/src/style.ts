import { create, cssomSheet } from 'twind';

export const sheet = cssomSheet({ target: new CSSStyleSheet() });
export const { tw } = create({
  sheet,
  plugins: {
    'select-big': 'appearance-none row-start-1 col-start-1 p-4 bg-transparent',
  },
});
