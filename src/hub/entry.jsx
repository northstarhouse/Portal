// The Volunteer Hub's Events Committee page, running inside the Portal. Same code, same tables, same tools:
// the page itself is mirrored in by scripts/sync-hub-events-committee.mjs.
import EventsCommittee from './pages/EventsCommittee.jsx';
import { VolContext } from './App.jsx';
import hubCss from './hubStyles.js';

// The volunteer who is signed in to the Portal (matched by the login email), so "Sign up" buttons can put their name on an item.
function useSignedInVolunteer() {
  const [me, setMe] = React.useState(null);
  React.useEffect(function() {
    let email = '';
    try { email = (localStorage.getItem('nsh-app-email') || '').trim(); } catch (e) { /* no storage */ }
    if (!email) return;
    let live = true;
    fetch('https://uvzwhhwzelaelfhfkvdb.supabase.co/rest/v1/' + encodeURIComponent('2026 Volunteers') + '?select=*&Email=ilike.' + encodeURIComponent(email) + '&limit=1', {
      headers: { apikey: 'sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do', Authorization: 'Bearer sb_publishable_EbFMfEbyEp3gASl-GZm3tQ_LnPEe5do' },
    }).then(function(r) { return r.ok ? r.json() : []; }).then(function(rows) { if (live && rows && rows[0] && rows[0].id != null) setMe(rows[0]); }).catch(function() { /* no sign-up buttons */ });
    return function() { live = false; };
  }, []);
  return me;
}

export default function HubEventsCommittee({ navigate }) {
  const signedIn = useSignedInVolunteer();
  const value = React.useMemo(function() {
    return {
      signedInVolunteer: signedIn,
      // The Portal has no per-person profile here; activity entries read "A Portal user".
      volunteer: { id: null, 'First Name': 'A Portal', 'Last Name': 'user', Team: 'Staff' },
      session: { user: { id: null } },
      currentCommitteeEvent: null,
      setCurrentCommitteeEvent: function() {},
      setView: function() {},
      navigate: navigate,
    };
  }, [navigate, signedIn]);
  return (
    <div className="hub-scope" style={{ margin: '-4px -4px 0' }}>
      <style>{hubCss}</style>
      <VolContext.Provider value={value}>
        <EventsCommittee />
      </VolContext.Provider>
    </div>
  );
}
