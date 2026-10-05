export default function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-end md:justify-between md:px-6">
        <div className="flex max-w-2xl flex-col gap-3">
          <p className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
            {eyebrow}
          </p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            {title}
          </h1>
          <p className="text-pretty leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        {children}
      </div>
    </header>
  );
}
