export function Logo({ href = "/projects" }: { href?: string }) {
  return (
    <a className="brand" href={href}>
      <img src="/brand/mark.svg" alt="" width={24} height={24} />
      test-flow
    </a>
  );
}
