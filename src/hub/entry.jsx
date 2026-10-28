// The Volunteer Hub's Events Committee page, running inside the Portal. Same code, same tables, same tools:
// the page itself is mirrored in by scripts/sync-hub-events-committee.mjs.
import EventsCommittee from './pages/EventsCommittee.jsx';
import { VolContext } from './App.jsx';
import hubCss from './hubStyles.js';

export default function HubEventsCommittee({ navigate }) {
  const value = React.useMemo(function() {
    return {
      // The Portal has no per-person profile here; activity entries read "A Portal user".
      volunteer: { id: null, 'First Name': 'A Portal', 'Last Name': 'user', Team: 'Staff' },
      session: { user: { id: null } },
      currentCommitteeEvent: null,
      setCurrentCommitteeEvent: function() {},
      setView: function() {},
      navigate: navigate,
    };
  }, [navigate]);
  return (
    <div className="hub-scope" style={{ margin: '-4px -4px 0' }}>
      <style>{hubCss}</style>
      <VolContext.Provider value={value}>
        <EventsCommittee />
      </VolContext.Provider>
    </div>
  );
}
