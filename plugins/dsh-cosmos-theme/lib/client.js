window.__ModuleLoader__.load({
  id: 'dsh-cosmos-theme',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    // Mirror of --ds-cosmos-* in themes/dsh-abyss-theme-design/theme.css.
    const palette = {
      base: '#050814', surface: '#0b1022', raised: '#121a32', overlay: '#141c35',
      text: '#e8edff', muted: '#aab8d6', accent: '#4c5bd0', link: '#b0bdff',
      line: '#26314f', 'line-strong': '#3b4b73', star: '#dceaff', violet: '#9b8dff',
      nebula: '#23204d', 'cloud-violet': '#684fa6', 'cloud-blue': '#365da8',
      'cloud-rose': '#864f83', cyan: '#86dbff', 'planet-light': '#7b8fdf',
      planet: '#111a40', 'planet-dark': '#070a18', clear: 'transparent',
    };
    const mapping = {
      '--dsw-alias-bg-base': 'base', '--dsw-alias-bg-layer-1': 'surface',
      '--dsw-alias-bg-layer-2': 'raised', '--dsw-alias-bg-overlay': 'overlay',
      '--dsw-alias-bg-module-platform': 'surface', '--dsw-alias-bg-document-preview': 'surface',
      '--dsw-alias-label-primary': 'text', '--dsw-alias-label-secondary': 'muted',
      '--dsw-alias-label-primary-foreground': 'text', '--dsw-alias-brand-text': 'text',
      '--dsw-alias-brand-primary': 'accent', '--dsw-alias-brand-primary-invert': 'text',
      '--dsw-alias-brand-primary-new-colorprimary-new-color': 'accent',
      '--dsw-alias-border-l1': 'line', '--dsw-alias-border-l2': 'line-strong',
      '--dsw-alias-border-l2-darkmode-thin': 'line', '--dsw-focus-ring-color': 'link',
      '--dsw-specific-sidebar-fill': 'surface', '--dsw-specific-sidebar-nav-item-active': 'raised',
      '--dsw-specific-sidebar-nav-item-active-accent': 'link', '--dsw-specific-input-major': 'raised',
      '--dsw-specific-bubble': 'raised', '--dsw-specific-bubble-highlight': 'overlay',
      '--dsw-specific-menu': 'overlay', '--dsw-specific-selector': 'raised',
      '--dsw-alias-toast-bg': 'overlay', '--dsw-alias-state-business-primary': 'link',
      '--dsw-alias-state-business-tertiary': 'nebula',
    };
    const variables = Object.entries(palette).map(([key, value]) => `--ds-cosmos-${key}:${value}`).join(';');
    const css = `:root{${variables}}
      .cosmos-sky{position:fixed;inset:0;overflow:hidden;pointer-events:none!important;user-select:none;z-index:0;
        mask-image:linear-gradient(90deg,var(--ds-cosmos-clear) 0%,var(--ds-cosmos-clear) 20%,color-mix(in srgb,var(--ds-cosmos-planet-dark) 8%,var(--ds-cosmos-clear)) 42%,color-mix(in srgb,var(--ds-cosmos-planet-dark) 38%,var(--ds-cosmos-clear)) 67%,color-mix(in srgb,var(--ds-cosmos-planet-dark) 80%,var(--ds-cosmos-clear)) 100%)}
      .cosmos-cloud{position:absolute;inset:-12%;opacity:.23;filter:blur(28px);background:
        radial-gradient(ellipse 27% 20% at 77% 23%,var(--ds-cosmos-cloud-violet),var(--ds-cosmos-clear) 75%),
        radial-gradient(ellipse 32% 20% at 84% 50%,var(--ds-cosmos-cloud-blue),var(--ds-cosmos-clear) 75%),
        radial-gradient(ellipse 22% 17% at 67% 68%,var(--ds-cosmos-cloud-rose),var(--ds-cosmos-clear) 75%);
        animation:cosmos-drift 20s ease-in-out infinite alternate}
      .cosmos-sweep{position:absolute;width:65%;height:16%;right:-9%;top:46%;transform:rotate(-23deg);border-radius:50%;filter:blur(20px);opacity:.16;background:linear-gradient(90deg,var(--ds-cosmos-clear),var(--ds-cosmos-cloud-violet),var(--ds-cosmos-cloud-blue),var(--ds-cosmos-clear))}
      .cosmos-planet{position:absolute;right:-5%;top:18%;width:min(32vw,420px);aspect-ratio:1;border-radius:50%;opacity:.28;background:radial-gradient(circle at 26% 23%,var(--ds-cosmos-planet-light),var(--ds-cosmos-planet) 26%,var(--ds-cosmos-planet-dark) 70%);box-shadow:0 0 50px var(--ds-cosmos-cloud-blue);animation:cosmos-float 22s ease-in-out infinite alternate}
      .cosmos-planet::after{content:'';position:absolute;inset:-15% -25%;border:1px solid var(--ds-cosmos-violet);border-radius:50%;transform:rotate(-23deg) scaleY(.3);opacity:.6}
      .cosmos-star{position:absolute;border-radius:50%;background:var(--ds-cosmos-star);opacity:var(--star-opacity);animation:cosmos-twinkle var(--period) ease-in-out var(--delay) infinite alternate}
      .cosmos-star--bright{background:var(--ds-cosmos-cyan);box-shadow:0 0 7px var(--ds-cosmos-cyan)}
      .cosmos-meteor{position:absolute;right:3%;top:14%;width:110px;height:1px;opacity:0;transform:rotate(-25deg);background:linear-gradient(90deg,var(--ds-cosmos-clear),var(--ds-cosmos-cyan));animation:cosmos-meteor 18s ease-in 6s infinite}
      .cosmos-sky:not([data-motion=rich]) .cosmos-meteor,.cosmos-sky[data-scene=focus] .cosmos-meteor{display:none}
      .cosmos-whale{position:absolute;right:0;top:17%;width:min(55vw,700px);height:auto;opacity:.18;filter:drop-shadow(0 0 18px var(--ds-cosmos-cloud-blue));animation:cosmos-float 24s ease-in-out infinite alternate}
      .cosmos-whale-body{fill:var(--ds-cosmos-cloud-blue);stroke:var(--ds-cosmos-cyan);stroke-width:2}
      .cosmos-whale-line{fill:none;stroke:var(--ds-cosmos-cyan);stroke-width:2;stroke-linecap:round;opacity:.8}
      .cosmos-whale-star{fill:var(--ds-cosmos-star)}
      .cosmos-sky[data-scene=whale] .cosmos-planet,.cosmos-sky[data-scene=whale] .cosmos-sweep{display:none}
      .cosmos-sky:not([data-scene=whale]) .cosmos-whale{display:none}
      .cosmos-sky[data-scene=focus] .cosmos-planet,.cosmos-sky[data-scene=focus] .cosmos-sweep{display:none}
      .cosmos-sky[data-scene=focus] .cosmos-cloud{opacity:.08}.cosmos-sky[data-scene=focus] .cosmos-star{opacity:.12;animation:none}
      .cosmos-sky[data-motion=quiet] .cosmos-cloud{animation-duration:40s}
      .cosmos-sky[data-motion=quiet] .cosmos-star{animation-duration:12s}
      .cosmos-sky[data-motion=quiet] .cosmos-planet,.cosmos-sky[data-motion=quiet] .cosmos-whale{animation-duration:40s}
      .cosmos-sky[data-motion=still] .cosmos-cloud,.cosmos-sky[data-motion=still] .cosmos-planet,.cosmos-sky[data-motion=still] .cosmos-whale,.cosmos-sky[data-motion=still] .cosmos-star{animation:none}
      .cosmos-sky[data-hidden=true] *{animation-play-state:paused!important}
      @keyframes cosmos-meteor{0%,90%,100%{opacity:0;translate:0 0}92%{opacity:.42}96%{opacity:0;translate:-120px 60px}}
      @keyframes cosmos-twinkle{from{opacity:.1;transform:scale(.8)}to{opacity:.65;transform:scale(1.2)}}
      @keyframes cosmos-drift{from{transform:translateX(-1%)}to{transform:translateX(2%)}}
      @keyframes cosmos-float{from{transform:translateY(0)}to{transform:translateY(-10px)}}
      .cosmos-controls{position:fixed;z-index:1;right:4px;top:72px;pointer-events:none;font:13px system-ui,sans-serif;color:var(--ds-cosmos-text)}
      .cosmos-controls button,.cosmos-controls select{font:inherit;color:var(--ds-cosmos-text);background:var(--ds-cosmos-overlay);border:1px solid var(--ds-cosmos-line-strong);border-radius:7px;pointer-events:auto}
      .cosmos-controls button{cursor:pointer}.cosmos-controls button:focus-visible,.cosmos-controls select:focus-visible{outline:2px solid var(--ds-cosmos-cyan);outline-offset:2px}
      .cosmos-launcher{display:block;margin-left:auto;width:30px;height:30px}
      .cosmos-panel{pointer-events:auto;width:220px;box-sizing:border-box;margin-top:5px;padding:12px;border:1px solid var(--ds-cosmos-line-strong);border-radius:10px;background:var(--ds-cosmos-surface);box-shadow:0 8px 24px var(--ds-cosmos-planet-dark)}
      .cosmos-panel-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.cosmos-panel-title strong{font-size:13px}.cosmos-panel-title button{padding:2px 7px}
      .cosmos-panel label{display:block;color:var(--ds-cosmos-muted);margin:8px 0 4px}.cosmos-panel select{display:block;width:100%;padding:6px}
      @media(max-width:600px){.cosmos-planet{width:55vw;right:-20%}.cosmos-whale{width:75vw;right:-10%}.cosmos-controls{top:64px}}
      @media(prefers-reduced-motion:reduce){.cosmos-sky *{animation:none!important}.cosmos-meteor{display:none!important}}
      @media print{.cosmos-sky,.cosmos-controls{display:none!important}}
    `;
    const SCENES = ['nebula', 'whale', 'focus'];
    const MOTIONS = ['rich', 'quiet', 'still'];
    const KEY = 'dsh-cosmos-theme.settings';
    const defaults = { scene: 'nebula', motion: 'quiet' };
    function readSettings() {
      try {
        const value = JSON.parse(window.localStorage.getItem(KEY) || '{}');
        return { scene: SCENES.includes(value.scene) ? value.scene : defaults.scene,
          motion: MOTIONS.includes(value.motion) ? value.motion : defaults.motion };
      } catch (_) { return { ...defaults }; }
    }
    function makeStars() {
      let seed = 31997;
      const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
      return Array.from({ length: 145 }, (_, index) => {
        const bright = index % 19 === 0;
        const size = bright ? 2.2 : .7 + random() * 1.2;
        return h('i', { key: index, className: `cosmos-star${bright ? ' cosmos-star--bright' : ''}`, style: {
          left: `${random() * 100}%`, top: `${random() * 100}%`, width: size, height: size,
          '--star-opacity': .22 + random() * .35, '--period': `${4 + random() * 5}s`, '--delay': `${-random() * 12}s`,
        } });
      });
    }
    const stars = makeStars();
    function Whale() {
      // Original inline vector, intentionally subtle above the shell; no asset route or network.
      return h('svg', { className: 'cosmos-whale', viewBox: '0 0 700 300', 'aria-hidden': true },
        h('path', { className: 'cosmos-whale-body', d: 'M87 162 C149 79 262 49 374 76 C432 90 481 111 527 108 C568 106 600 88 633 72 C625 100 605 121 580 136 C610 151 629 172 637 198 C601 183 566 167 526 166 C468 164 431 200 361 214 C253 235 151 216 87 162 Z' }),
        h('path', { className: 'cosmos-whale-body', d: 'M302 195 C335 232 335 255 298 271 C343 270 389 248 404 210 Z' }),
        h('path', { className: 'cosmos-whale-line', d: 'M115 168 C210 190 348 193 462 164 M154 183 C195 204 258 213 307 214 M449 113 C474 120 492 129 504 140' }),
        h('circle', { className: 'cosmos-whale-star', cx: 165, cy: 145, r: 3 }),
        h('circle', { className: 'cosmos-whale-star', cx: 252, cy: 116, r: 2 }),
        h('circle', { className: 'cosmos-whale-star', cx: 335, cy: 135, r: 2.5 }),
        h('circle', { className: 'cosmos-whale-star', cx: 414, cy: 158, r: 2 }));
    }
    function Experience() {
      const [settings, setSettings] = React.useState(readSettings);
      const [hidden, setHidden] = React.useState(document.hidden);
      const [open, setOpen] = React.useState(false);
      const launcher = React.useRef(null);
      React.useEffect(() => {
        const visibility = () => setHidden(document.hidden);
        const sync = (event) => { if (event.key === KEY || event.key === null) setSettings(readSettings()); };
        document.addEventListener('visibilitychange', visibility);
        window.addEventListener('storage', sync);
        return () => { document.removeEventListener('visibilitychange', visibility); window.removeEventListener('storage', sync); };
      }, []);
      function change(field, value) {
        const next = { ...settings, [field]: value };
        setSettings(next);
        try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch (_) { /* session-only if storage is unavailable */ }
      }
      function close() { setOpen(false); if (launcher.current) launcher.current.focus(); }
      return h(React.Fragment, null,
        h('div', { className: 'cosmos-sky', 'aria-hidden': true, 'data-scene': settings.scene, 'data-motion': settings.motion, 'data-hidden': String(hidden), 'data-cosmos-stars': stars.length },
          h('div', { className: 'cosmos-cloud' }), h('div', { className: 'cosmos-sweep' }),
          h('div', { className: 'cosmos-planet' }), h('div', { className: 'cosmos-meteor' }), h(Whale), stars),
        h('div', { className: 'cosmos-controls', onKeyDown: (event) => { if (open && event.key === 'Escape') { event.stopPropagation(); close(); } } },
          h('button', { ref: launcher, type: 'button', className: 'cosmos-launcher', 'aria-label': '深空主题设置', 'aria-expanded': open, 'aria-controls': 'cosmos-settings', onClick: () => setOpen(!open), title: '深空主题设置' }, '✦'),
          open && h('section', { id: 'cosmos-settings', className: 'cosmos-panel', 'aria-label': '深空主题设置' },
            h('div', { className: 'cosmos-panel-title' }, h('strong', null, '深空主题'), h('button', { type: 'button', onClick: close, 'aria-label': '关闭深空主题设置' }, '×')),
            h('label', { htmlFor: 'cosmos-scene' }, '背景场景'),
            h('select', { id: 'cosmos-scene', value: settings.scene, onChange: (e) => change('scene', e.target.value) },
              h('option', { value: 'nebula' }, '星云航迹'), h('option', { value: 'whale' }, '深空鲸影'), h('option', { value: 'focus' }, '极夜专注')),
            h('label', { htmlFor: 'cosmos-motion' }, '动效'),
            h('select', { id: 'cosmos-motion', value: settings.motion, onChange: (e) => change('motion', e.target.value) },
              h('option', { value: 'rich' }, '丰富'), h('option', { value: 'quiet' }, '柔和'), h('option', { value: 'still' }, '静态')))));
    }
    return {
      inject: ['slots', 'theme'],
      apply(ctx) {
        const tokens = Object.fromEntries(Object.entries(mapping).map(([key, value]) => [key, { light: palette[value], dark: palette[value] }]));
        ctx.effect(() => ctx.theme.overrideTokens('dsh-cosmos-theme', tokens));
        ctx.effect(() => {
          const style = document.createElement('style');
          style.id = 'dsh-cosmos-theme-style'; style.textContent = css;
          document.head.append(style);
          document.documentElement.setAttribute('data-cosmos-applied', '0.2.0');
          return () => { style.remove(); document.documentElement.removeAttribute('data-cosmos-applied'); };
        });
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'cosmos.starfield', order: -100 }, Experience));
      },
    };
  },
});
