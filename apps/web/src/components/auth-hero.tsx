export function AuthHero() {
  return (
    <aside className="auth-hero">
      <div className="glow glow-violet" aria-hidden>
        <div>
          <img src="/brand/glow-violet.svg" alt="" />
        </div>
      </div>
      <div className="glow glow-green" aria-hidden>
        <div>
          <img src="/brand/glow-green.svg" alt="" />
        </div>
      </div>
      <div className="hero-copy">
        <span className="eyebrow">
          <img src="/brand/eyebrow-dot.svg" alt="" width={6} height={6} />
          {"flow-qa  →  tfs push  →  test-flow"}
        </span>
        <h2 className="hero-title">
          Cada rodada de QA,
          <br />
          <span className="accent">guardada com a evidência.</span>
        </h2>
        <p className="hero-lede">
          Plano, relatório e cada screenshot, payload e HTML da rodada num só lugar. O agente publica pela CLI; você
          consulta no portal.
        </p>
      </div>
      <div className="terminal">
        <div className="terminal-bar">
          <img src="/brand/win-red.svg" alt="" />
          <img src="/brand/win-yellow.svg" alt="" />
          <img src="/brand/win-green.svg" alt="" />
          <span>agente — code-for-coders</span>
        </div>
        <div className="terminal-body">
          <span>
            <span className="t-muted">$ </span>tfs push qa-evidence --project code-for-coders
          </span>
          <span>
            <span className="t-ok">✓ </span>
            <span className="t-sec">3 raízes com qa_session.json</span>
          </span>
          <span className="t-sec">{"  qa-cap002-acesso-interno-2026-10-07"}</span>
          <span className="t-sec">{"  archive-2026-10-07-cap001-conta-aluno"}</span>
          <span className="t-sec">{"  archive-2026-10-07-cap030-trilha-auditoria"}</span>
          <span className="t-muted">{"– ignorado: spec/node_modules/ · test-output/"}</span>
          <span>
            <span className="t-arrow">↑ </span>
            <span className="t-sec">upload direto para o R2 (URL pré-assinada)</span>
          </span>
          <span>
            <span className="t-ok">✓ </span>
            <span className="t-ok">rodadas publicadas em /projects/code-for-coders</span>
          </span>
        </div>
      </div>
      <div className="hero-card">
        <div className="hero-card-info">
          <span className="title">qa-cap001-conta-aluno-2026-10-07</span>
          <span className="meta">28 pass · 0 fail · 0 blocked · 1 n/e</span>
        </div>
        <span className="badge pass">
          <img src="/brand/dot-pass.svg" alt="" width={6} height={6} />
          APROVADO
        </span>
      </div>
    </aside>
  );
}
