import { samplePrompts } from '@/lib/mock/data';

// Optional demo-only entry points. The Working Card never selects a fixture or scenario.
export default function DemoInputs({ onSelect }: { onSelect: (message: string) => void }) {
  return <><div className="sample-heading">Try an example</div><div className="samples">{samplePrompts.map(sample => <button key={sample.id} onClick={() => onSelect(sample.message)}><span>{sample.icon}</span>{sample.title}<span>↗</span></button>)}</div></>;
}
