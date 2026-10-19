import type { Metadata } from 'next';
import './globals.css';
import './assumptions.css';
export const metadata:Metadata={title:'Show Your Work',description:'See every assumption. Explore your next move.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) {return <html lang="en"><body>{children}</body></html>;}
