/**
 * Development-only visual lab (/__ui). Renders the application shell and the
 * component kit with static sample values so the theme can be reviewed in
 * light and dark without signing in. It never calls the API and is not part
 * of production builds (the route is registered only when import.meta.env.DEV).
 */
import { useState } from 'react';
import {
  AlertItem, Avatar, Badge, Banner, Button, Card, Chart, Chips, Dl, Flow, Grid, Icon, Kpi, Legend, BrandMark, Meter,
  Modal, PageHead, Person, Segment, SelectField, StatStrip, Stepper, Switch, Tabs, TextField, Timeline, useToast,
} from '@/components/ui';
import { charts } from '@/lib/legacy-charts';
import { useTheme } from '@/theme/theme';

const NAV = [
  { group: 'Academics', icon: 'book', items: ['Attendance', 'Timetable', 'Assessments', 'Curriculum'] },
  { group: 'Students', icon: 'users', items: ['All Students', 'Student Tracking', 'Wellbeing'] },
  { group: 'Finance', icon: 'wallet', items: ['Fees', 'Payments', 'Concessions'] },
  { group: 'Safety', icon: 'shield', items: ['Transport', 'Emergency'] },
];

const ROWS = [
  { name: 'Aarav Kumar', adm: 'HS-2026-1091', cls: '5A', att: 96, status: 'At School', tone: 'success' },
  { name: 'Diya Menon', adm: 'HS-2026-1044', cls: '6B', att: 88, status: 'In Transit', tone: 'warning' },
  { name: 'Ishaan Reddy', adm: 'HS-2026-1102', cls: '4A', att: 72, status: 'At Risk', tone: 'critical' },
  { name: 'Meera Pillai', adm: 'HS-2026-1017', cls: '7C', att: 99, status: 'At Home', tone: 'info' },
];

export default function UiLab() {
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const [tab, setTab] = useState<'overview' | 'academics' | 'fees'>('overview');
  const [seg, setSeg] = useState<'day' | 'week' | 'month'>('week');
  const [chip, setChip] = useState<'all' | 'risk'>('all');
  const [sw, setSw] = useState(true);
  const [modal, setModal] = useState(false);
  const [open, setOpen] = useState('Students');

  return (
    <div className="app" data-rail="false" data-drawer="false" data-search="false">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <BrandMark size={36} />
          <span className="col grow" style={{ minWidth: 0 }}>
            <span className="sidebar__name">Edunex</span>
            <span className="sidebar__tag">International School</span>
          </span>
        </div>
        <div className="sidebar__find">
          <span className="sidebar__findico"><Icon name="search" size={15} /></span>
          <input className="sidebar__findinput" type="search" placeholder="Find a page…" aria-label="Find a page" />
        </div>
        <nav className="sidebar__scroll" aria-label="Lab navigation">
          <div className="navgroup navgroup--pinned" data-open="true">
            <div className="navgroup__items">
              <a className="navitem" aria-current="page" href="#"><span className="navitem__ico"><Icon name="grid" size={17} /></span><span className="navitem__label">Command Centre</span></a>
              <a className="navitem" href="#"><span className="navitem__ico"><Icon name="bell" size={17} /></span><span className="navitem__label">Notifications</span><span className="navitem__count navitem__count--alert">7</span></a>
              <a className="navitem" href="#"><span className="navitem__ico"><Icon name="check" size={17} /></span><span className="navitem__label">My Tasks</span><span className="navitem__count">3</span></a>
            </div>
          </div>
          {NAV.map((g) => (
            <div className="navgroup" key={g.group} data-open={String(open === g.group)}>
              <button className="navhead" aria-expanded={open === g.group} onClick={() => setOpen(open === g.group ? '' : g.group)}>
                <span className="navhead__ico"><Icon name={g.icon} size={17} /></span>
                <span className="navhead__label">{g.group}</span>
                <span className="navhead__count">{g.items.length}</span>
                <span className="navhead__chev"><Icon name="chevronDown" size={14} /></span>
              </button>
              <div className="navgroup__items">
                {g.items.map((i) => (
                  <a className="navitem" key={i} href="#"><span className="navitem__ico"><Icon name="chevronRight" size={15} /></span><span className="navitem__label">{i}</span></a>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="sidebar__foot">
          <div className="sidebar__footrow">
            <button className="sidebar__role grow">
              <Avatar name="Meera Krishnan" size="sm" tone="avatar--amber" />
              <span className="col grow" style={{ minWidth: 0 }}>
                <span className="sidebar__role-name t-clip">Meera Krishnan</span>
                <span className="sidebar__role-title t-clip">Principal</span>
              </span>
              <Icon name="more" size={15} />
            </button>
            <button className="iconbtn iconbtn--onnavy none sidebar__logout" aria-label="Sign out"><Icon name="logout" size={17} /></button>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar__ctx">
            <button className="ctxselect">
              <Icon name="building" size={16} />
              <span className="col"><span className="ctxselect__label">Campus</span><span className="ctxselect__value">Coimbatore — Main</span></span>
              <Icon name="chevronDown" size={14} />
            </button>
            <button className="ctxselect">
              <span className="col"><span className="ctxselect__label">Academic Year</span><span className="ctxselect__value">2026–27</span></span>
              <Icon name="chevronDown" size={14} />
            </button>
          </div>
          <div className="globalsearch">
            <span className="globalsearch__ico"><Icon name="search" size={16} /></span>
            <input className="globalsearch__input" type="search" placeholder="Search students, parents, staff, fees…" aria-label="Search" />
            <span className="globalsearch__kbd">Ctrl K</span>
          </div>
          <div className="spacer" />
          <Button variant="amber" size="sm" icon="sparkle" className="topbar__hideSm">AI Assistant</Button>
          <button className="iconbtn iconbtn--onnavy" aria-label="Notifications"><Icon name="bell" size={18} /><span className="iconbtn__dot">7</span></button>
          <button className="iconbtn iconbtn--onnavy topbar__lang topbar__hideSm" aria-label="Language"><span>EN</span></button>
          <button className="iconbtn iconbtn--onnavy themetoggle" onClick={toggle} aria-label="Toggle theme"><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} /></button>
          <button className="topbar__user">
            <Avatar name="Meera Krishnan" size="sm" tone="avatar--amber" />
            <span className="col topbar__usertext"><span className="topbar__username">Meera Krishnan</span><span className="topbar__userrole">Principal</span></span>
            <Icon name="chevronDown" size={14} />
          </button>
        </header>
        <main className="view">
          <div className="page">
            <PageHead
              crumbs={[{ label: 'Home' }, { label: 'Command Centre' }]}
              title="Good morning, Meera"
              sub="Thursday 17 September · everything that needs your attention today"
              actions={<><Button variant="ghost" icon="download">Export</Button><Button variant="primary" icon="plus" onClick={() => setModal(true)}>New announcement</Button></>}
            />
            <Grid cols="g-4col">
              <Kpi label="Students present" value="1,284" unit="/ 1,342" delta={2.4} spark={[88, 90, 91, 89, 93, 95, 96]} foot="vs last week" />
              <Kpi label="Fees collected" value="₹48.2L" delta={6.1} tone="teal" foot="this term" />
              <Kpi label="Buses on route" value="14" unit="/ 16" tone="amber" foot="2 delayed" />
              <Kpi label="Students at risk" value="9" delta={-1.2} inverse tone="critical" foot="needs review" />
            </Grid>

            <Grid cols="g-main" className="mt-5">
              <Card title="Students" sub="Live status across Grade 4–7" flush actions={<Chips items={[{ id: 'all', label: 'All' }, { id: 'risk', label: 'At risk' }]} active={chip} onChange={setChip} />}>
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Student</th><th>Admission No.</th><th>Class</th><th className="num">Attendance</th><th>Status</th></tr></thead>
                    <tbody>
                      {ROWS.map((r) => (
                        <tr key={r.adm} className="row--link">
                          <td><Person name={r.name} meta={`Grade ${r.cls}`} /></td>
                          <td className="t-mono t-sm">{r.adm}</td>
                          <td>{r.cls}</td>
                          <td className="num">{r.att}%</td>
                          <td><Badge tone={r.tone} dot>{r.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <Card title="Needs attention" flush>
                <AlertItem tone="critical" icon="alertTriangle" title="Bus 7 delayed by 18 minutes" meta="Route Saibaba Colony · 32 students" />
                <AlertItem tone="warning" icon="wallet" title="46 fee reminders due today" meta="Term 2 instalment" />
                <AlertItem tone="info" icon="users" title="3 admissions awaiting approval" meta="Grade 1 and 2" />
                <AlertItem tone="success" icon="check" title="Attendance marked for 38 of 40 classes" meta="Updated 9:12 AM" />
              </Card>
            </Grid>

            <Grid cols="g-3col" className="mt-5">
              <Card title="Attendance trend" actions={<Segment items={[{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }]} active={seg} onChange={setSeg} />}>
                <Chart svg={charts.line({ labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], series: [{ name: 'Present', values: [93, 95, 94, 96, 92, 90], color: 'var(--viz-1)' }, { name: 'Target', values: [95, 95, 95, 95, 95, 95], color: 'var(--viz-3)', dashed: true }], height: 190 })} />
                <div className="mt-3"><Legend items={[{ label: 'Present', color: 'var(--viz-1)' }, { label: 'Target', color: 'var(--viz-3)' }]} /></div>
              </Card>
              <Card title="Fee collection" sub="By payment mode">
                <Chart svg={charts.bar({ labels: ['UPI', 'Card', 'Net', 'Cash'], series: [{ name: 'Lakh', values: [22, 11, 9, 6], color: 'var(--viz-1)' }], height: 190 })} />
              </Card>
              <Card title="Term progress">
                <div className="col g-4">
                  <Meter label="Curriculum coverage" value={72} right="72%" />
                  <Meter label="Assessments graded" value={88} right="88%" tone="teal" />
                  <Meter label="Fee collection" value={64} right="64%" />
                  <Meter label="Transport on time" value={41} right="41%" tone="critical" />
                </div>
              </Card>
            </Grid>

            <Grid cols="g-2col" className="mt-5">
              <Card title="Form controls">
                <Tabs items={[{ id: 'overview', label: 'Overview' }, { id: 'academics', label: 'Academics' }, { id: 'fees', label: 'Fees' }]} active={tab} onChange={setTab} />
                <div className="form-grid mt-4">
                  <TextField label="Student name" value="Aarav Kumar" onChange={() => {}} required />
                  <SelectField label="Class" value="5A" onChange={() => {}} options={[{ value: '5A', label: 'Grade 5A' }, { value: '5B', label: 'Grade 5B' }]} />
                  <TextField label="Parent email" value="" placeholder="name@example.com" onChange={() => {}} hint="Used for fee receipts" />
                  <TextField label="Phone" value="98" onChange={() => {}} error="Enter a 10-digit number" />
                </div>
                <div className="row g-4 mt-4 wrap">
                  <Switch checked={sw} onChange={setSw} label="Send SMS alerts" />
                  <Stepper steps={['Enquiry', 'Visit', 'Test', 'Enrol']} active={2} />
                </div>
                <div className="row g-2 mt-5 wrap">
                  <Button variant="primary">Save changes</Button>
                  <Button variant="amber" icon="sparkle">Ask AI</Button>
                  <Button variant="ghost">Cancel</Button>
                  <Button variant="quiet">Reset</Button>
                  <Button variant="danger" icon="trash" size="sm">Delete</Button>
                  <Button variant="teal" size="sm" onClick={() => toast('Attendance saved', 'success', 'check')}>Show toast</Button>
                </div>
              </Card>
              <Card title="Student 360 snapshot">
                <div className="row g-4">
                  <Avatar name="Aarav Kumar" size="xl" />
                  <div className="grow">
                    <div className="h2">Aarav Kumar</div>
                    <div className="t-sm t-muted">Grade 5A · Roll 14 · Tagore House</div>
                    <div className="row g-2 mt-2 wrap"><Badge tone="success" dot>At School</Badge><Badge tone="gold">Scholar</Badge><Badge tone="neutral">Bus 7</Badge></div>
                  </div>
                </div>
                <div className="divider" />
                <Dl items={[['Admission No.', 'HS-2026-1091'], ['Location', <span className="coord" key="c">11.0168, 76.9558</span>], ['Guardian', 'Ranjith Kumar']]} />
                <div className="mt-4"><Banner tone="warning" icon="alertTriangle">Library book overdue by 3 days.</Banner></div>
                <div className="mt-3"><Banner icon="info">Parent–teacher meeting on 24 September.</Banner></div>
              </Card>
            </Grid>

            <Grid cols="g-2col" className="mt-5">
              <Card title="Admissions flow">
                <Flow steps={[{ label: 'Enquiry', meta: '124', state: 'done' }, { label: 'Campus visit', meta: '68', state: 'done' }, { label: 'Assessment', meta: '41', state: 'active' }, { label: 'Enrolled', meta: '27' }]} />
                <StatStrip items={[{ label: 'Conversion', value: '21.8%' }, { label: 'Avg. days', value: '9' }, { label: 'Pending', value: '14' }]} />
              </Card>
              <Card title="Today">
                <Timeline items={[
                  { time: '08:05', title: 'Aarav boarded Bus 7', body: 'Stop: Race Course Road', tone: 'teal' },
                  { time: '08:41', title: 'Arrived at campus', body: 'Gate 2 · RFID check-in' },
                  { time: '11:30', title: 'Maths assessment', body: 'Scored 18 / 20', tone: 'amber' },
                ]} />
              </Card>
            </Grid>
          </div>
        </main>
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title="New announcement" sub="Sent to parents of the selected classes." foot={<><Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button><Button variant="primary" onClick={() => setModal(false)}>Send</Button></>}>
        <div className="col g-4">
          <TextField label="Title" value="Sports day" onChange={() => {}} />
          <Banner tone="success" icon="check">412 parents will receive this.</Banner>
        </div>
      </Modal>
    </div>
  );
}
