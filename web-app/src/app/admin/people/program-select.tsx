"use client";

export default function ProgramSelect({ programs, selected }: {
  programs: { id: string; name: string }[];
  selected: string;
}) {
  return <label>Program
    <select name="program" key={selected} defaultValue={selected} onChange={event => event.currentTarget.form?.requestSubmit()}>
      {programs.map(program => <option value={program.id} key={program.id}>{program.name}</option>)}
    </select>
  </label>;
}
