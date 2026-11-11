"use client";

import { useState } from "react";

type ClassOption = { id: string; label: string; title: string; price: number; remaining: number };
const money = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function ClassSelector({ classes, initialSelection }: { classes: ClassOption[]; initialSelection: string[] }) {
  const [selected, setSelected] = useState(initialSelection);
  const total = classes.filter(item => selected.includes(item.id)).reduce((sum, item) => sum + item.price, 0);
  return <form action="/drop-in" method="get" className="stack-form">
    <input type="hidden" name="step" value="details" />
    <fieldset><legend>Choose your class dates</legend><div className="drop-in-months">{classes.map(item => <label className="panel check-label" key={item.id}>
      <input type="checkbox" name="class" value={item.id} disabled={!item.remaining} checked={selected.includes(item.id)} onChange={event => setSelected(previous => event.target.checked ? [...previous, item.id] : previous.filter(id => id !== item.id))} />
      <span><strong>{item.label}</strong><br />{item.title} · {money(item.price)} · {item.remaining ? `${item.remaining} spots left` : "Full"}</span>
    </label>)}</div></fieldset>
    <p aria-live="polite"><strong>{selected.length} {selected.length === 1 ? "class" : "classes"} selected · Total {money(total)}</strong></p>
    <button className="button primary" type="submit" disabled={!selected.length}>Continue</button>
    <p>Your spots are reserved after you complete the next step.</p>
  </form>;
}
