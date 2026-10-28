// In the Volunteer Hub this is the Event Overviews page (P&L, Feedback, Plans). In the Portal those tabs are the
// Portal's own Event Overviews view, which app.jsx registers on window for this popout to render.
import { useVol } from '../App.jsx';

export default function EventOverviews({ initialTab }) {
  const { navigate } = useVol();
  const View = window.__NSH_EVENT_REPORTS;
  if (!View) return null;
  return <View navigate={navigate} initialTab={initialTab} />;
}
