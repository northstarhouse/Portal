// Stand-in for the Volunteer Hub's App.jsx: the mirrored pages only need its useVol() context.
// The Portal supplies the values in entry.jsx.
export const VolContext = React.createContext(null);
export const useVol = () => React.useContext(VolContext);
