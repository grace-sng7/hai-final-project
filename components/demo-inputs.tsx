import { categories, samples, type DemoSample } from '@/lib/mock/data';

// Optional demo-only entry points. The Working Card never selects a fixture or scenario.
// Each example runs immediately and is grouped by the extraction challenge it demonstrates.
export default function DemoInputs({ onSelect, disabled = false }: { onSelect: (sample: DemoSample) => void; disabled?: boolean }) {
  return <section className="examples" aria-labelledby="examples-heading"><div className="sample-heading" id="examples-heading">Try an example</div>
    <ul className="example-grid">{samples.map(sample => <li key={sample.id}><button className={`example-card category-${sample.category}`} disabled={disabled} onClick={() => onSelect(sample)}>
      <span className="category-tag">{categories[sample.category].label}</span>
      <span className="example-title"><span aria-hidden="true">{sample.icon}</span>{sample.title}</span>
      <span className="example-description">{sample.description}</span>
      <span className="example-message">{'\u201c'}{sample.message}{'\u201d'}</span>
    </button></li>)}</ul></section>;
}
