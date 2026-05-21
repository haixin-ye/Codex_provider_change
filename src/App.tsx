import {
  AlertTriangle,
  Archive,
  BarChart3,
  CheckCircle2,
  CircleHelp,
  Database,
  FolderOpen,
  Loader2,
  Maximize2,
  Minus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X
} from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { MigrationProgress, MigrationResult, ProviderDistribution, ScanResult } from "./types";

type BusyState = "idle" | "scanning" | "migrating";

const PROVIDER_COLORS = ["#7C8CFF", "#44C7B6", "#E2A95E", "#D9658B", "#8A71E8", "#6DB7F2", "#9EA6B3"];
const DESIGN_WIDTH = 1220;
const FALLBACK_DESIGN_HEIGHT = 940;
const MIN_UI_SCALE = 0.7;
const MAX_UI_SCALE = 0.9;

export function App() {
  const [codexHome, setCodexHome] = useState("");
  const [targetProvider, setTargetProvider] = useState("");
  const [selectedSourceProviders, setSelectedSourceProviders] = useState<string[]>([]);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [busy, setBusy] = useState<BusyState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [progressLog, setProgressLog] = useState<MigrationProgress[]>([]);
  const [appScale, setAppScale] = useState(1);
  const shellRef = useRef<HTMLDivElement | null>(null);

  const providerOptions = useMemo(() => collectProviderOptions(scan), [scan]);

  useEffect(() => {
    const api = window.codexProviderFixer;
    if (!api) {
      setError("Electron 桥接未加载，请重新构建后启动应用。");
      return;
    }

    const unsubscribe = api.onMigrationProgress((nextProgress) => {
      setProgress(nextProgress);
      setProgressLog((current) => [...current.filter((item) => item.stage !== nextProgress.stage), nextProgress]);
    });
    void initialize();
    return unsubscribe;
  }, []);

  useEffect(() => {
    const updateScale = () => {
      const availableWidth = Math.max(0, window.innerWidth - 44);
      const availableHeight = Math.max(0, window.innerHeight - 64);
      const contentHeight = shellRef.current?.scrollHeight || FALLBACK_DESIGN_HEIGHT;
      const fitScale = Math.min(availableWidth / DESIGN_WIDTH, availableHeight / contentHeight);
      setAppScale(Math.min(MAX_UI_SCALE, Math.max(MIN_UI_SCALE, fitScale)));
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  useEffect(() => {
    setSelectedSourceProviders(providerOptions.filter((provider) => provider !== targetProvider));
  }, [providerOptions, targetProvider]);

  async function initialize() {
    setBusy("scanning");
    setError(null);
    try {
      const api = getApi();
      const home = await api.getDefaultHome();
      setCodexHome(home);
      const nextScan = await api.scan(home);
      setScan(nextScan);
      setTargetProvider(nextScan.configProvider || "");
    } catch (caught) {
      setError(messageFromError(caught));
    } finally {
      setBusy("idle");
    }
  }

  async function refresh() {
    setBusy("scanning");
    setError(null);
    setResult(null);
    setProgress(null);
    setProgressLog([]);
    try {
      const nextScan = await getApi().scan(codexHome);
      setScan(nextScan);
      if (!targetProvider && nextScan.configProvider) {
        setTargetProvider(nextScan.configProvider);
      }
    } catch (caught) {
      setError(messageFromError(caught));
    } finally {
      setBusy("idle");
    }
  }

  async function chooseHome() {
    try {
      const selected = await getApi().chooseHome();
      if (!selected) return;
      setCodexHome(selected);
      setResult(null);
      setProgress(null);
      setProgressLog([]);
      setBusy("scanning");
      setError(null);
      const nextScan = await getApi().scan(selected);
      setScan(nextScan);
      setTargetProvider(nextScan.configProvider || targetProvider);
    } catch (caught) {
      setError(messageFromError(caught));
    } finally {
      setBusy("idle");
    }
  }

  async function migrate() {
    setBusy("migrating");
    setError(null);
    setResult(null);
    setProgress(null);
    setProgressLog([]);
    try {
      const migration = await getApi().migrate({
        codexHome,
        targetProvider,
        sourceProviders: selectedSourceProviders
      });
      setResult(migration);
      setScan(migration.after);
    } catch (caught) {
      setError(messageFromError(caught));
    } finally {
      setBusy("idle");
    }
  }

  function toggleSourceProvider(provider: string) {
    setSelectedSourceProviders((current) =>
      current.includes(provider) ? current.filter((item) => item !== provider) : [...current, provider]
    );
  }

  const preview = useMemo(
    () => buildPreview(scan, targetProvider, selectedSourceProviders),
    [scan, targetProvider, selectedSourceProviders]
  );
  const canMigrate = Boolean(
    scan?.databaseExists && targetProvider.trim() && selectedSourceProviders.length && busy === "idle"
  );
  const progressPercent = progress?.total
    ? Math.min(100, Math.round(((progress.current ?? 0) / progress.total) * 100))
    : result
      ? 100
      : 0;

  return (
    <main className="app-root">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <TitleBar onHelp={() => setIsHelpOpen(true)} />

      <div className="app-viewport">
        <div className="app-shell" ref={shellRef} style={{ "--app-scale": appScale } as CSSProperties}>
        <section className="hero">
          <div>
            <p className="eyebrow">LOCAL CODEX MAINTENANCE</p>
            <h1>让 Codex 历史记录跟随当前 Provider</h1>
            <p className="lede">
              扫描本地 <code>state_5.sqlite</code> 与 <code>sessions</code> 元数据，迁移前自动创建可回滚备份。
            </p>
          </div>
          <div className="hero-panel">
            <Sparkles size={18} />
            <span>当前目标</span>
            <strong>{targetProvider || "未设置"}</strong>
          </div>
        </section>

        <section className="workspace">
          <aside className="control-panel surface">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">迁移目标</span>
                <h2>Provider 设置</h2>
              </div>
              <button className="icon-button" onClick={refresh} disabled={busy !== "idle"} title="重新扫描">
                {busy === "scanning" ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
              </button>
            </div>

            <label className="field">
              <span>Codex 目录</span>
              <div className="path-row">
                <input value={codexHome} onChange={(event) => setCodexHome(event.target.value)} />
                <button className="icon-button" onClick={chooseHome} title="选择目录">
                  <FolderOpen size={17} />
                </button>
              </div>
            </label>

            <label className="field">
              <span>目标 Provider</span>
              <input
                value={targetProvider}
                onChange={(event) => setTargetProvider(event.target.value)}
                placeholder="ccswitch"
              />
            </label>

            <SourceProviderPicker
              providers={providerOptions}
              selected={selectedSourceProviders}
              target={targetProvider}
              onToggle={toggleSourceProvider}
            />

            <div className="hint-box">
              <ShieldCheck size={17} />
              <p>
                默认读取自 <code>config.toml</code>：
                <strong>{scan?.configProvider || "未找到"}</strong>
              </p>
            </div>

            <button className="primary-action" disabled={!canMigrate} onClick={migrate}>
              {busy === "migrating" ? "迁移进行中" : "备份并迁移"}
            </button>
            <button className="secondary-action" disabled={busy !== "idle"} onClick={refresh}>
              重新扫描
            </button>
          </aside>

          <section className="dashboard">
            <div className="top-stack">
              {error ? <StatusBanner tone="danger" text={error} /> : null}
              {scan?.errors.length ? <StatusBanner tone="warning" text={scan.errors.join(" ")} /> : null}
              <div className="stats-grid">
                <Metric title="线程记录" value={scan?.threadCount ?? 0} detail={scan?.databaseExists ? "state_5.sqlite" : "未找到"} />
                <Metric title="Session 文件" value={scan?.sessionCount ?? 0} detail={scan?.sessionsExists ? "jsonl metadata" : "未找到"} />
                <Metric title="待更新" value={preview.totalToUpdate} detail={`${selectedSourceProviders.length} 个源名称`} />
              </div>
            </div>

            <div className="columns">
              <Distribution title="state_5.sqlite 中记录的 Provider 条目" distribution={scan?.databaseDistribution ?? {}} target={targetProvider} selected={selectedSourceProviders} />
              <Distribution title="sessions 文件夹中保存的历史会话 Provider" distribution={scan?.sessionDistribution ?? {}} target={targetProvider} selected={selectedSourceProviders} />
            </div>

            <AuditPanel
              busy={busy}
              progress={progress}
              progressLog={progressLog}
              progressPercent={progressPercent}
              result={result}
              backupRoot={`${scan?.codexHome || codexHome}\\backups`}
            />
          </section>
        </section>
        </div>
      </div>
      {isHelpOpen ? <HelpDialog onClose={() => setIsHelpOpen(false)} /> : null}
    </main>
  );
}

function TitleBar({ onHelp }: { onHelp: () => void }) {
  return (
    <header className="window-chrome">
      <div className="brand">
        <div className="brand-mark">
          <Database size={15} />
        </div>
        <span>Codex Provider History Fixer</span>
      </div>
      <div className="nav-meta">
        <button className="help-button" onClick={onHelp} title="为什么需要迁移">
          <CircleHelp size={15} />
        </button>
        <span className="status-pill">本机模式</span>
        <span className="version">v0.1.0</span>
        <div className="window-actions">
          <button title="最小化" onClick={() => getApi().windowAction("minimize")}>
            <Minus size={14} />
          </button>
          <button title="最大化" onClick={() => getApi().windowAction("maximize")}>
            <Maximize2 size={13} />
          </button>
          <button className="close" title="关闭" onClick={() => getApi().windowAction("close")}>
            <X size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}

function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="help-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="help-dialog surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="help-dialog-header">
          <div>
            <span className="section-kicker">Why migrate</span>
            <h2 id="help-title">为什么需要迁移 Provider</h2>
          </div>
          <button className="icon-button compact" onClick={onClose} title="关闭说明">
            <X size={16} />
          </button>
        </div>

        <div className="help-copy">
          <section>
            <strong>为什么历史会话会突然不显示？</strong>
            <p>
              Codex 显示历史会话时，会按当前账号或配置里的 provider 去匹配本地历史记录。
              简单说就是：当前 provider 和历史记录里的 provider 对齐，历史记录才会出现在列表里。
            </p>
          </section>

          <section>
            <strong>为什么换 provider 后容易出问题？</strong>
            <p>
              新用户切换到其他供应商后，当前 provider 名称可能和以前记录里的名称不一样。
              比如旧记录是 <code>openai</code>，现在配置里是 <code>ccswitch</code>，Codex 就可能认为它们不是同一批会话。
            </p>
          </section>

          <section>
            <strong>为什么不直接改 config.toml？</strong>
            <p>
              有些情况下可以把 <code>config.toml</code> 里的 provider 改成旧名称来同步。
              但官方账号通常没有 provider 字段，它默认使用 <code>openai</code>。
              对自定义供应商来说，不能简单把 provider name 改成 <code>openai</code> 来伪装官方账号。
            </p>
          </section>

          <section>
            <strong>这个工具做了什么？</strong>
            <p>
              它会先备份 <code>state_5.sqlite</code> 和 <code>sessions</code> 原始会话文件，
              再把你选中的旧 provider 名称迁移为当前目标 provider，让历史会话重新和当前账号对齐。
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}

function SourceProviderPicker({
  providers,
  selected,
  target,
  onToggle
}: {
  providers: string[];
  selected: string[];
  target: string;
  onToggle: (provider: string) => void;
}) {
  return (
    <section className="source-picker">
      <div className="source-heading">
        <span>要迁移的源名称</span>
        <small>{selected.length}/{providers.filter((provider) => provider !== target).length}</small>
      </div>
      <div className="source-list">
        {providers.length ? (
          providers.map((provider) => {
            const isTarget = provider === target;
            const checked = selected.includes(provider);
            return (
              <label className={isTarget ? "source-option target" : checked ? "source-option checked" : "source-option"} key={provider}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isTarget}
                  onChange={() => onToggle(provider)}
                />
                <span>{provider}</span>
                <em>{isTarget ? "目标" : checked ? "迁移" : "保留"}</em>
              </label>
            );
          })
        ) : (
          <div className="source-empty">扫描后显示可迁移名称</div>
        )}
      </div>
    </section>
  );
}

function Metric({ title, value, detail }: { title: string; value: number; detail: string }) {
  return (
    <div className="metric surface">
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function Distribution({
  title,
  distribution,
  target,
  selected
}: {
  title: string;
  distribution: ProviderDistribution;
  target: string;
  selected: string[];
}) {
  const entries = Object.entries(distribution).sort(([, a], [, b]) => b - a);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  const slices = buildPieSlices(entries, total, target, selected);
  const selectedCount = selected.reduce((sum, provider) => sum + (distribution[provider] ?? 0), 0);
  const selectedPercent = total ? Math.round((selectedCount / total) * 100) : 0;

  return (
    <article className="distribution surface">
      <div className="distribution-heading">
        <div>
          <span className="section-kicker">Provider Map</span>
          <h2>{title}</h2>
        </div>
        <BarChart3 size={18} />
      </div>

      {entries.length ? (
        <div className="provider-bars">
          <div className="distribution-summary">
            <div>
              <span>总计</span>
              <strong><AnimatedNumber value={total} /></strong>
            </div>
            <div>
              <span>将被迁移</span>
              <strong><AnimatedNumber value={selectedCount} /></strong>
            </div>
          </div>

          <div className="stacked-bar migration-bar" title={`将被迁移: ${selectedCount}/${total}`}>
            <AnimatedBar width={selectedPercent} />
          </div>

          <div className="provider-list">
            {slices.items.map((item) => {
              const percent = total ? Math.round((item.count / total) * 100) : 0;
              const stateClass =
                item.provider === target ? "provider-row target" : selected.includes(item.provider) ? "provider-row selected" : "provider-row";
              return (
                <ProviderDistributionRow
                  key={`${item.provider}-${item.count}-${total}`}
                  className={stateClass}
                  color={item.color}
                  count={item.count}
                  percent={percent}
                  provider={item.provider}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <div className="empty-state">没有找到 provider 元数据</div>
      )}
    </article>
  );
}

function ProviderDistributionRow({
  className,
  color,
  count,
  percent,
  provider
}: {
  className: string;
  color: string;
  count: number;
  percent: number;
  provider: string;
}) {
  return (
    <div className={className}>
      <div className="provider-row-label">
        <span className="legend-dot" style={{ background: color }} />
        <strong>{provider}</strong>
        <em>
          <span><AnimatedNumber value={count} /> 条</span>
          <small><AnimatedNumber value={percent} />%</small>
        </em>
      </div>
      <div className="provider-track">
        <AnimatedBar color={color} width={percent} />
      </div>
    </div>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const animated = useAnimatedNumber(value);
  return <>{animated}</>;
}

function AnimatedBar({ color, width }: { color?: string; width: number }) {
  const animatedWidth = useAnimatedNumber(width, 760);
  const normalizedWidth = width <= 0 ? 0 : animatedWidth;
  return (
    <span
      style={{
        width: `${normalizedWidth}%`,
        background: color,
        color
      }}
    />
  );
}

function useAnimatedNumber(value: number, duration = 720): number {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    let startTime: number | null = null;
    const startValue = displayValue;
    const targetValue = Number.isFinite(value) ? value : 0;

    const tick = (time: number) => {
      startTime ??= time;
      const progress = Math.min(1, (time - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startValue + (targetValue - startValue) * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, value]);

  return displayValue;
}

function AuditPanel({
  busy,
  progress,
  progressLog,
  progressPercent,
  result,
  backupRoot
}: {
  busy: BusyState;
  progress: MigrationProgress | null;
  progressLog: MigrationProgress[];
  progressPercent: number;
  result: MigrationResult | null;
  backupRoot: string;
}) {
  const stages = (["scan", "backup", "database", "sessions"] as Array<MigrationProgress["stage"]>).map(
    (stage, index) => ({
      stage,
      number: index + 1,
      label:
        stage === "scan"
          ? "扫描配置"
          : stage === "backup"
            ? "完整备份"
            : stage === "database"
              ? "更新数据库"
              : "更新 Session Metadata"
    })
  );

  return (
    <section className="audit-panel surface">
      <div className="audit-header">
        <div>
          <span className="section-kicker">迁移审计</span>
          <h2>{progress?.label || (result ? "迁移完成" : "等待执行")}</h2>
        </div>
        <span className={result ? "status-pill success" : "status-pill"}>
          {busy === "migrating" ? "运行中" : result ? "已完成" : "就绪"}
        </span>
      </div>

      <div className="progress-track">
        <div className={busy === "migrating" ? "progress-fill breathing" : "progress-fill"} style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="audit-steps">
        {stages.map(({ stage, number, label }) => {
          const item = progressLog.find((entry) => entry.stage === stage);
          const active = progress?.stage === stage;
          const done = Boolean(item) || Boolean(result);
          return (
            <div className={active ? "audit-step active" : done ? "audit-step done" : "audit-step"} key={stage}>
              <span className="step-number">{number}</span>
              <div>
                <strong>{label}</strong>
                <p>
                  {item?.detail ||
                    (stage === "backup"
                      ? "备份 state_5.sqlite 与 sessions"
                      : stage === "sessions"
                        ? "同步 sessions/**/*.jsonl"
                        : "等待执行")}
                </p>
              </div>
              {item?.total ? <em>{Math.round(((item.current ?? 0) / item.total) * 100)}%</em> : null}
            </div>
          );
        })}
      </div>

      {result ? (
        <div className="result-box">
          <CheckCircle2 size={18} />
          <div>
            <strong>
              已更新 {result.updatedThreadRows} 条线程记录，{result.updatedSessionFiles} 个 Session 文件
            </strong>
            <button className="text-button" onClick={() => getApi().openPath(result.backupDir)}>
              打开备份目录：{result.backupDir}
            </button>
          </div>
        </div>
      ) : (
        <div className="backup-note">
          <Archive size={16} />
          <span>写入前会完整备份数据库和 sessions 原始会话：{backupRoot}</span>
        </div>
      )}
    </section>
  );
}

function StatusBanner({ tone, text }: { tone: "danger" | "warning"; text: string }) {
  return (
    <div className={`status-banner ${tone}`}>
      <AlertTriangle size={17} />
      <span>{text}</span>
    </div>
  );
}

function collectProviderOptions(scan: ScanResult | null): string[] {
  if (!scan) return [];
  return [...new Set([...Object.keys(scan.databaseDistribution), ...Object.keys(scan.sessionDistribution)])].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

function buildPieSlices(entries: Array<[string, number]>, total: number, target: string, selected: string[]) {
  if (!entries.length || total <= 0) {
    return { gradient: "#202226", items: [] };
  }

  let cursor = 0;
  const items = entries.map(([provider, count], index) => {
    const color = provider === target ? "#35C275" : PROVIDER_COLORS[index % PROVIDER_COLORS.length];
    const start = cursor;
    const end = cursor + (count / total) * 100;
    cursor = end;
    return { provider, count, color, start, end };
  });

  const gradient = `conic-gradient(${items
    .map((item) => `${item.color} ${item.start.toFixed(2)}% ${item.end.toFixed(2)}%`)
    .join(", ")})`;

  return { gradient, items };
}

function buildPreview(scan: ScanResult | null, targetProvider: string, selectedSourceProviders: string[]) {
  if (!scan || !targetProvider || !selectedSourceProviders.length) {
    return { totalToUpdate: 0 };
  }
  const selected = new Set(selectedSourceProviders);
  const threadUpdates = countSelected(scan.databaseDistribution, selected);
  const sessionUpdates = countSelected(scan.sessionDistribution, selected);
  return { totalToUpdate: threadUpdates + sessionUpdates };
}

function countSelected(distribution: ProviderDistribution, selected: Set<string>): number {
  return Object.entries(distribution).reduce((sum, [provider, count]) => (selected.has(provider) ? sum + count : sum), 0);
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getApi() {
  if (!window.codexProviderFixer) {
    throw new Error("Electron 桥接未加载，请重新运行 npm run build 后再 npm start。");
  }
  return window.codexProviderFixer;
}
