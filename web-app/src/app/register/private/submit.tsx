'use client';
import { useFormStatus } from 'react-dom';
export default function PrivateSubmit({label='Continue to secure payment'}:{label?:string}) {
  const {pending}=useFormStatus();
  return <button className="button primary" disabled={pending} type="submit">{pending?'Please wait…':label}</button>;
}
