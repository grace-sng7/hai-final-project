import { categories, samples } from '@/lib/mock/presentation-samples';

// Optional demo-only entry points. The Working Card never selects a fixture or scenario.
export default function DemoInputs({ onSelect }: { onSelect: (message: string) => void }) {
  return <><div className="sample-heading">Try an example</div><div className="samples">{samples.map(sample => <button key={sample.id} onClick={() => onSelect(sample.message)}><span>{sample.icon}</span>{sample.title} ({categories[sample.category].label.replace(/\b\w/g, c => c.toUpperCase())})<span>↗</span></button>)}</div></>;
}
