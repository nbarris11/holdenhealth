import Link from "next/link";
import styles from "./brand-logo.module.css";

export default function BrandLogo({ href = "/", subtitle, className = "" }: {
  href?: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={`${styles.logo} ${className}`}>
      <span className={styles.mark} aria-hidden="true">h.</span>
      <span className={styles.copy}>
        <strong className={styles.name}>holden health</strong>
        {subtitle ? <small className={styles.subtitle}>{subtitle}</small> : null}
      </span>
    </Link>
  );
}
