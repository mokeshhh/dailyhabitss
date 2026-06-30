import './globals.css';

export const metadata = {
  title: 'Mee — Daily Habit Tracker',
  description: 'Personal daily habit tracker for Mokesh — gym, diet, hydration & more.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
