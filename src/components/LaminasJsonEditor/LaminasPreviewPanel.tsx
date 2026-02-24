import { useRef } from 'react';
import type { CSSProperties, RefObject, PointerEvent as ReactPointerEvent, ReactNode, WheelEvent as ReactWheelEvent } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LaminaLayoutItem, LaminaLayoutMap, LaminaTemplate } from './types';
import { renderTextoComDestaques } from './utils';

type MovableBoxProps = {
  id: string;
  enabled: boolean;
  active?: boolean;
  selected?: boolean;
  layout: LaminaLayoutMap;
  onChange: (id: string, patch: Partial<LaminaLayoutItem>) => void;
  onSelect?: (id: string) => void;
  scale?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  innerRef?: RefObject<HTMLDivElement>;
  minWidth?: number;
  minHeight?: number;
  snapEnabled?: boolean;
  snapGrid?: number;
  snapTolerance?: number;
};

function MovableBox({
  id,
  enabled,
  active,
  selected,
  layout,
  onChange,
  onSelect,
  scale = 1,
  className,
  style,
  children,
  innerRef,
  minWidth = 40,
  minHeight = 30,
  snapEnabled = true,
  snapGrid = 8,
  snapTolerance = 6,
}: MovableBoxProps) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const ref = innerRef ?? localRef;
  const rect = layout[id];
  const applyLayout = !!rect && (active ?? enabled);

  const handleSelect = () => {
    if (applyLayout) {
      onSelect?.(id);
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled || !rect) return;
    if (event.button !== 0) return;
    onSelect?.(id);
    const target = event.target as HTMLElement | null;
    const isResize = target?.dataset.resizeHandle === 'true';
    event.preventDefault();
    event.stopPropagation();

    const container = ref.current?.closest('.lamina-preview') as HTMLElement | null;
    const containerRect = container?.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startRect = { ...rect };
    const effectiveScale = scale || 1;
    const targets = Object.entries(layout)
      .filter(([key, item]) => key !== id && item)
      .map(([, item]) => item as LaminaLayoutItem);
    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
    const maybeSnapToGrid = (value: number) => {
      if (!snapEnabled || snapGrid <= 1) return value;
      const snapped = Math.round(value / snapGrid) * snapGrid;
      return Math.abs(snapped - value) <= snapTolerance ? snapped : value;
    };
    const snapMove = (value: number, size: number, targetEdges: number[]) => {
      if (!snapEnabled) return value;
      let bestDelta = snapTolerance + 1;
      let snappedValue = value;
      const left = value;
      const right = value + size;
      const center = value + size / 2;
      const candidates = [
        { edge: left, offset: 0 },
        { edge: right, offset: size },
        { edge: center, offset: size / 2 },
      ];

      targetEdges.forEach((edge) => {
        candidates.forEach((candidate) => {
          const delta = Math.abs(candidate.edge - edge);
          if (delta <= snapTolerance && delta < bestDelta) {
            bestDelta = delta;
            snappedValue = edge - candidate.offset;
          }
        });
      });

      return snappedValue;
    };
    const snapResize = (origin: number, size: number, targetEdges: number[]) => {
      if (!snapEnabled) return size;
      let bestDelta = snapTolerance + 1;
      let snappedSize = size;
      const edge = origin + size;
      targetEdges.forEach((target) => {
        const delta = Math.abs(edge - target);
        if (delta <= snapTolerance && delta < bestDelta) {
          bestDelta = delta;
          snappedSize = target - origin;
        }
      });
      return snappedSize;
    };
    const buildEdges = (item: LaminaLayoutItem, axis: 'x' | 'y') => {
      const start = axis === 'x' ? item.x : item.y;
      const size = axis === 'x' ? item.w : item.h;
      return [start, start + size, start + size / 2];
    };
    const targetEdgesX = targets.flatMap((item) => buildEdges(item, 'x'));
    const targetEdgesY = targets.flatMap((item) => buildEdges(item, 'y'));
    if (containerRect) {
      const containerWidth = containerRect.width / effectiveScale;
      const containerHeight = containerRect.height / effectiveScale;
      targetEdgesX.push(0, containerWidth, containerWidth / 2);
      targetEdgesY.push(0, containerHeight, containerHeight / 2);
    }
    const maxX = containerRect ? containerRect.width / effectiveScale - startRect.w : Number.POSITIVE_INFINITY;
    const maxY = containerRect ? containerRect.height / effectiveScale - startRect.h : Number.POSITIVE_INFINITY;
    const maxW = containerRect ? containerRect.width / effectiveScale - startRect.x : Number.POSITIVE_INFINITY;
    const maxH = containerRect ? containerRect.height / effectiveScale - startRect.y : Number.POSITIVE_INFINITY;

    const handleMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / effectiveScale;
      const dy = (moveEvent.clientY - startY) / effectiveScale;

      if (isResize) {
        let nextW = Math.max(minWidth, startRect.w + dx);
        let nextH = Math.max(minHeight, startRect.h + dy);
        nextW = clamp(nextW, minWidth, maxW);
        nextH = clamp(nextH, minHeight, maxH);
        nextW = maybeSnapToGrid(nextW);
        nextH = maybeSnapToGrid(nextH);
        nextW = snapResize(startRect.x, nextW, targetEdgesX);
        nextH = snapResize(startRect.y, nextH, targetEdgesY);
        nextW = clamp(nextW, minWidth, maxW);
        nextH = clamp(nextH, minHeight, maxH);
        onChange(id, { w: nextW, h: nextH });
        return;
      }

      let nextX = startRect.x + dx;
      let nextY = startRect.y + dy;
      nextX = clamp(nextX, 0, maxX);
      nextY = clamp(nextY, 0, maxY);
      nextX = maybeSnapToGrid(nextX);
      nextY = maybeSnapToGrid(nextY);
      nextX = snapMove(nextX, startRect.w, targetEdgesX);
      nextY = snapMove(nextY, startRect.h, targetEdgesY);
      nextX = clamp(nextX, 0, maxX);
      nextY = clamp(nextY, 0, maxY);
      onChange(id, { x: nextX, y: nextY });
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const mergedStyle: CSSProperties = {
    ...style,
    ...(applyLayout
      ? {
          position: 'absolute',
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
        }
      : {}),
  };

  const classes = [className, applyLayout ? 'lamina-movable' : null, selected ? 'lamina-selected' : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={ref}
      className={classes}
      style={mergedStyle}
      onPointerDown={enabled ? handlePointerDown : undefined}
      onClick={handleSelect}
    >
      {children}
      {enabled && rect && <span className="lamina-resize-handle" data-resize-handle="true" />}
    </div>
  );
}

type LaminasPreviewPanelProps = {
  previewRef: RefObject<HTMLDivElement>;
  previewWidth?: number;
  previewHeight?: number;
  exportandoPdf: boolean;
  modoLivre: boolean;
  layoutAtivo: boolean;
  zoomAplicado: number;
  templatePreview: LaminaTemplate;
  logoTopo: string | null;
  logoRodape: string | null;
  layoutMap: LaminaLayoutMap;
  selectedBlock: string | null;
  onLayoutChange: (id: string, patch: Partial<LaminaLayoutItem>) => void;
  onSelectBlock: (id: string) => void;
  isBlocoVisivel: (id: string) => boolean;
  onPreviewPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPreviewWheel: (event: ReactWheelEvent<HTMLDivElement>) => void;
  topbarRef: RefObject<HTMLDivElement>;
  introRef: RefObject<HTMLDivElement>;
  dividerRef: RefObject<HTMLDivElement>;
  leftRef: RefObject<HTMLDivElement>;
  atribuicaoRef: RefObject<HTMLDivElement>;
  chartRef: RefObject<HTMLDivElement>;
  tablesRef: RefObject<HTMLDivElement>;
  mesRef: RefObject<HTMLDivElement>;
  comentariosRef: RefObject<HTMLDivElement>;
  operacionalRef: RefObject<HTMLDivElement>;
  footerRef: RefObject<HTMLDivElement>;
  dadosGrafico: LaminaTemplate['chart']['data'];
  dadosDrawdown: Array<{ label: string; drawdown: number }>;
};

export default function LaminasPreviewPanel({
  previewRef,
  previewWidth,
  previewHeight,
  exportandoPdf,
  modoLivre,
  layoutAtivo,
  zoomAplicado,
  templatePreview,
  logoTopo,
  logoRodape,
  layoutMap,
  selectedBlock,
  onLayoutChange,
  onSelectBlock,
  isBlocoVisivel,
  onPreviewPointerDown,
  onPreviewWheel,
  topbarRef,
  introRef,
  dividerRef,
  leftRef,
  atribuicaoRef,
  chartRef,
  tablesRef,
  mesRef,
  comentariosRef,
  operacionalRef,
  footerRef,
  dadosGrafico,
  dadosDrawdown,
}: LaminasPreviewPanelProps) {
  const leftVisivel = isBlocoVisivel('left');
  const atribuicaoVisivel = isBlocoVisivel('atribuicao');
  const leftStackVisivel = leftVisivel || atribuicaoVisivel;
  const rightVisivel = ['chart', 'tables', 'mes', 'comentarios', 'operacional'].some((id) => isBlocoVisivel(id));
  const drawdownMin = dadosDrawdown.length
    ? Math.min(...dadosDrawdown.map((item) => item.drawdown), -0.1)
    : -0.1;

  return (
    <div className="laminas-preview-panel" onPointerDownCapture={onPreviewPointerDown} onWheelCapture={onPreviewWheel}>
      <div
        className="lamina-preview-zoom"
        style={previewWidth && previewHeight ? { width: previewWidth, height: previewHeight } : undefined}
      >
        <div
          ref={previewRef}
          className={`lamina-preview lamina-mensal${exportandoPdf ? ' lamina-exporting' : ''}${modoLivre ? ' lamina-freeform' : ''}${layoutAtivo ? ' lamina-layout-active' : ''}`}
          style={{
            transform: zoomAplicado !== 1 ? `scale(${zoomAplicado})` : undefined,
            transformOrigin: 'top left',
          }}
        >
          {isBlocoVisivel('topbar') && (
            <MovableBox
              id="topbar"
              enabled={modoLivre}
              active={layoutAtivo}
              selected={selectedBlock === 'topbar'}
              layout={layoutMap}
              onChange={onLayoutChange}
              onSelect={onSelectBlock}
              scale={zoomAplicado}
              className="lamina-topbar"
              innerRef={topbarRef}
              minHeight={50}
              snapEnabled={modoLivre}
            >
              <div className="lamina-brand">
                <div className={`lamina-logo${logoTopo ? ' has-image' : ''}`}>
                  {logoTopo ? <img src={logoTopo} alt="Logo UP" /> : templatePreview.header.logo}
                </div>
                <div>
                  <h2>{templatePreview.header.titulo}</h2>
                  <p>{templatePreview.header.subtitulo}</p>
                </div>
              </div>
              <div className="lamina-metric">
                <span>{templatePreview.header.periodo}</span>
                <strong>{templatePreview.header.destaque}</strong>
              </div>
            </MovableBox>
          )}

          {isBlocoVisivel('intro') && (
            <MovableBox
              id="intro"
              enabled={modoLivre}
              active={layoutAtivo}
              selected={selectedBlock === 'intro'}
              layout={layoutMap}
              onChange={onLayoutChange}
              onSelect={onSelectBlock}
              scale={zoomAplicado}
              className="lamina-intro"
              innerRef={introRef}
              minHeight={80}
              snapEnabled={modoLivre}
            >
              {templatePreview.intro.map((paragrafo, index) => (
                <p key={`intro-${index}`}>{renderTextoComDestaques(paragrafo.texto, paragrafo.destaques)}</p>
              ))}
            </MovableBox>
          )}

          {isBlocoVisivel('divider') && (
            <MovableBox
              id="divider"
              enabled={modoLivre}
              active={layoutAtivo}
              selected={selectedBlock === 'divider'}
              layout={layoutMap}
              onChange={onLayoutChange}
              onSelect={onSelectBlock}
              scale={zoomAplicado}
              className="lamina-divider"
              innerRef={dividerRef}
              minHeight={4}
              minWidth={120}
              snapEnabled={modoLivre}
            />
          )}

          {(leftStackVisivel || rightVisivel) && (
            <div className={`lamina-main${!leftStackVisivel && !layoutAtivo ? ' lamina-main-single' : ''}`}>
              {leftStackVisivel && (
                <div className="lamina-left-column">
                  {leftVisivel && (
                    <MovableBox
                      id="left"
                      enabled={modoLivre}
                      active={layoutAtivo}
                      selected={selectedBlock === 'left'}
                      layout={layoutMap}
                      onChange={onLayoutChange}
                      onSelect={onSelectBlock}
                      scale={zoomAplicado}
                      className="lamina-left"
                      innerRef={leftRef}
                      minWidth={220}
                      minHeight={220}
                      snapEnabled={modoLivre}
                    >
                      <div className="lamina-publico">
                        <span>Público Alvo:</span>
                        <p>{templatePreview.publicoAlvo}</p>
                      </div>

                      <div className="lamina-kpi-list">
                        {templatePreview.kpis.map((kpi, index) => (
                          <div key={`${kpi.label}-${index}`} className="lamina-kpi-item">
                            <span>{kpi.label}</span>
                            <strong>{kpi.value}</strong>
                          </div>
                        ))}
                      </div>
                    </MovableBox>
                  )}

                  {atribuicaoVisivel && (
                    <MovableBox
                      id="atribuicao"
                      enabled={modoLivre}
                      active={layoutAtivo}
                      selected={selectedBlock === 'atribuicao'}
                      layout={layoutMap}
                      onChange={onLayoutChange}
                      onSelect={onSelectBlock}
                      scale={zoomAplicado}
                      className="lamina-atribuicao-card"
                      innerRef={atribuicaoRef}
                      minWidth={220}
                      minHeight={180}
                      snapEnabled={modoLivre}
                    >
                      <div className="lamina-atribuicao">
                        <h4>Drawdown da Carteira</h4>
                        {dadosDrawdown.length === 0 ? (
                          <p className="lamina-empty">Sem dados para calcular o drawdown.</p>
                        ) : (
                          <div className="lamina-pie">
                            <ResponsiveContainer width="100%" height={150}>
                              <AreaChart data={dadosDrawdown} margin={{ top: 10, right: 8, bottom: 0, left: -10 }}>
                                <CartesianGrid strokeDasharray="3 4" stroke="var(--border-color, #d7e0ea)" />
                                <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="var(--text-muted, #415a72)" />
                                <YAxis
                                  domain={[drawdownMin, 0]}
                                  width={44}
                                  tick={{ fontSize: 9 }}
                                  stroke="var(--text-muted, #415a72)"
                                  tickFormatter={(value: number) => `${value.toFixed(2)}%`}
                                />
                                <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
                                <Area
                                  type="monotone"
                                  dataKey="drawdown"
                                  stroke="var(--primary-color)"
                                  fill="rgba(29, 47, 52, 0.18)"
                                  strokeWidth={1.4}
                                  dot={false}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    </MovableBox>
                  )}
                </div>
              )}

              {rightVisivel && (
                <section className="lamina-right">
                  {isBlocoVisivel('chart') && (
                    <MovableBox
                      id="chart"
                      enabled={modoLivre}
                      active={layoutAtivo}
                      selected={selectedBlock === 'chart'}
                      layout={layoutMap}
                      onChange={onLayoutChange}
                      onSelect={onSelectBlock}
                      scale={zoomAplicado}
                      className="lamina-chart-card"
                      innerRef={chartRef}
                      minWidth={240}
                      minHeight={160}
                      snapEnabled={modoLivre}
                    >
                      <div className="lamina-chart-header">
                        <h3>{templatePreview.chart.title}</h3>
                        <span>{templatePreview.chart.subtitle}</span>
                      </div>
                      <div className="lamina-chart-body">
                        <ResponsiveContainer width="100%" height={190}>
                          <LineChart data={dadosGrafico} margin={{ top: 10, right: 16, bottom: 0, left: -6 }}>
                            <CartesianGrid strokeDasharray="3 4" stroke="var(--border-color, #d7e0ea)" />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--text-muted, #415a72)" />
                            <YAxis
                              tick={{ fontSize: 10 }}
                              stroke="var(--text-muted, #415a72)"
                              tickFormatter={(value: number) =>
                                `${value.toLocaleString('pt-BR', {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 2,
                                })}%`
                              }
                            />
                            <Legend
                              verticalAlign="top"
                              align="right"
                              iconType="line"
                              height={24}
                              wrapperStyle={{ fontSize: 10 }}
                            />
                            <Tooltip />
                            <Line
                              type="monotone"
                              dataKey="tatica"
                              name="Estratégia"
                              stroke="var(--primary-color)"
                              strokeWidth={2.2}
                              dot={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="ifix"
                              name="IFIX"
                              stroke="var(--success-color)"
                              strokeWidth={2}
                              dot={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="cdi"
                              name="CDI"
                              stroke="var(--secondary-color)"
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </MovableBox>
                  )}

                  {isBlocoVisivel('tables') && (
                    <MovableBox
                      id="tables"
                      enabled={modoLivre}
                      active={layoutAtivo}
                      selected={selectedBlock === 'tables'}
                      layout={layoutMap}
                      onChange={onLayoutChange}
                      onSelect={onSelectBlock}
                      scale={zoomAplicado}
                      className="lamina-tables"
                      innerRef={tablesRef}
                      minWidth={240}
                      minHeight={160}
                      snapEnabled={modoLivre}
                    >
                      <div className="lamina-resumo">
                        <h4>Resumo Mensal</h4>
                        <table>
                          <tbody>
                            {templatePreview.resumoMensal.map((item) => (
                              <tr key={item.label}>
                                <td>{item.label}</td>
                                <td>{item.value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="lamina-performance">
                        <h4>Performance</h4>
                        <table>
                          <thead>
                            <tr>
                              {templatePreview.tabelaPerformance.headers.map((header) => (
                                <th key={header}>{header}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {templatePreview.tabelaPerformance.rows.map((row, index) => (
                              <tr key={`row-${index}`}>
                                {row.map((cell, cellIndex) => (
                                  <td key={`cell-${cellIndex}`}>{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </MovableBox>
                  )}

                  {isBlocoVisivel('mes') && (
                    <MovableBox
                      id="mes"
                      enabled={modoLivre}
                      active={layoutAtivo}
                      selected={selectedBlock === 'mes'}
                      layout={layoutMap}
                      onChange={onLayoutChange}
                      onSelect={onSelectBlock}
                      scale={zoomAplicado}
                      className="lamina-mes"
                      innerRef={mesRef}
                      minWidth={200}
                      minHeight={36}
                      snapEnabled={modoLivre}
                    >
                      <h3>{templatePreview.mesTitulo}</h3>
                      <div className="lamina-mes-line" />
                    </MovableBox>
                  )}

                  {isBlocoVisivel('comentarios') && (
                    <MovableBox
                      id="comentarios"
                      enabled={modoLivre}
                      active={layoutAtivo}
                      selected={selectedBlock === 'comentarios'}
                      layout={layoutMap}
                      onChange={onLayoutChange}
                      onSelect={onSelectBlock}
                      scale={zoomAplicado}
                      className="lamina-comentarios"
                      innerRef={comentariosRef}
                      minWidth={240}
                      minHeight={120}
                      snapEnabled={modoLivre}
                    >
                      {templatePreview.comentarios.map((paragrafo, index) => (
                        <p key={`comentario-${index}`}>
                          {renderTextoComDestaques(paragrafo.texto, paragrafo.destaques)}
                        </p>
                      ))}
                    </MovableBox>
                  )}

                  {isBlocoVisivel('operacional') && (
                    <MovableBox
                      id="operacional"
                      enabled={modoLivre}
                      active={layoutAtivo}
                      selected={selectedBlock === 'operacional'}
                      layout={layoutMap}
                      onChange={onLayoutChange}
                      onSelect={onSelectBlock}
                      scale={zoomAplicado}
                      className="lamina-operacional"
                      innerRef={operacionalRef}
                      minWidth={240}
                      minHeight={120}
                      snapEnabled={modoLivre}
                    >
                      <h4>{templatePreview.operacional.titulo}</h4>
                      <ul>
                        {templatePreview.operacional.itens.map((item, index) => (
                          <li key={`operacional-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </MovableBox>
                  )}
                </section>
              )}
            </div>
          )}

          {isBlocoVisivel('footer') && (
            <MovableBox
              id="footer"
              enabled={modoLivre}
              active={layoutAtivo}
              selected={selectedBlock === 'footer'}
              layout={layoutMap}
              onChange={onLayoutChange}
              onSelect={onSelectBlock}
              scale={zoomAplicado}
              className="lamina-footer"
              innerRef={footerRef}
              minWidth={240}
              minHeight={40}
              snapEnabled={modoLivre}
            >
              <span>{templatePreview.rodape.texto}</span>
              <span>{templatePreview.rodape.codigo}</span>
              <div className={`lamina-footer-logo${logoRodape ? ' has-image' : ''}`}>
                {logoRodape ? <img src={logoRodape} alt="Logo UP" /> : templatePreview.rodape.logo}
              </div>
            </MovableBox>
          )}
        </div>
      </div>
    </div>
  );
}























