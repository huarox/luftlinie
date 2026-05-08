import { useCallback, useEffect } from 'react';
import { useGameState } from '@/hooks/useGameState';
import { LandingScreen } from '@/screens/LandingScreen';
import { SetupScreen } from '@/screens/SetupScreen';
import { MapScreen } from '@/screens/MapScreen';
import { HostLobbyScreen } from '@/screens/HostLobbyScreen';
import { HostActiveScreen } from '@/screens/HostActiveScreen';
import { SpectatorScreen } from '@/screens/SpectatorScreen';
import { JoinScreen } from '@/screens/JoinScreen';
import { NavWaitScreen } from '@/screens/NavWaitScreen';
import { NavActiveScreen } from '@/screens/NavActiveScreen';
import { ResultsScreen } from '@/screens/ResultsScreen';
import { HostRoleScreen } from '@/screens/HostRoleScreen';
import { CountdownOverlay, ArrivalOverlay, EliminatedOverlay, SpeedWarnOverlay, AbortSheet, QRSheet, Toast } from '@/overlays/Overlays';

export default function App() {
  const gs = useGameState();
  const { state } = gs;

  // GPS update loop
  useEffect(() => {
    if (state.status !== 'active' || !state.myLat || !state.myLon || !state.myToken) return;
    const iv = setInterval(() => { gs.sendPos(); gs.checkBlind(); }, 1000);
    return () => clearInterval(iv);
  }, [state.status, state.myLat, state.myLon, state.myToken, state.settings.blindStart]);

  const handleHost = useCallback(async () => {
    const { code, noiseSeed, timeLimitSec } = await gs.createGame();
    gs.setS({ gameCode: code, isHost: true, noiseSeed, timeLimitSec, screen: 'setup', myName: gs.state.myName || 'Host' });
  }, [gs]);

  const handleConfirmTarget = useCallback(async (target: { lat: number; lon: number } | null, multi?: Array<{ lat: number; lon: number }> | null) => {
    const { ref: dbRef, update: dbUpdate, getDatabase } = await import('firebase/database');
    const d = getDatabase();
    if (multi && multi.length >= 3) {
      await dbUpdate(dbRef(d, `games/${gs.state.gameCode}`), { targetLat: multi[0].lat, targetLon: multi[0].lon, multiTargets: multi });
      gs.setS({ targetLat: multi[0].lat, targetLon: multi[0].lon, multiTargets: multi, screen: 'hlobby' });
    } else if (target) {
      await dbUpdate(dbRef(d, `games/${gs.state.gameCode}`), { targetLat: target.lat, targetLon: target.lon });
      gs.setS({ targetLat: target.lat, targetLon: target.lon, screen: 'hlobby' });
    }
    gs.startListeners(gs.state.gameCode!);
  }, [gs]);

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      {state.screen === 'land' && <LandingScreen state={state} onHost={handleHost} onJoin={() => gs.setScreen('join')} onToggleTheme={gs.toggleTheme} onDismissRejoin={gs.dismissRejoin} onDoRejoin={gs.doRejoin} />}
      {state.screen === 'setup' && <SetupScreen state={state} onBack={() => { gs.setScreen('land'); gs.goHome(); }} onGoMap={() => gs.setScreen('hostrole')} updateSettings={gs.updateSettings} />}
      {state.screen === 'hostrole' && <HostRoleScreen state={state} onSelect={(role) => {
        const code = state.gameCode!;
        const idealKm = (state.settings.idealMin / 60) * 35;

        const placeTargetAndGo = (lat: number, lon: number) => {
          gs.findSmartTarget(lat, lon, idealKm).then((t: any) => {
            if (t) {
              import('firebase/database').then(({ ref, update: dbUpd, getDatabase }) => {
                const d = getDatabase();
                dbUpd(ref(d, 'games/' + code), { targetLat: t.lat, targetLon: t.lon });
              });
              gs.setS({ targetLat: t.lat, targetLon: t.lon, screen: 'hlobby' });
            } else {
              gs.setScreen('hlobby');
            }
          });
        };

        if (role === 'navigator' && state.settings.mode === 'manual') {
          // Manual: go to map to place target
          gs.setScreen('map');
        } else {
          // Smart (any role) or Spectator: auto-find target, skip map
          navigator.geolocation.getCurrentPosition(
            (pos) => placeTargetAndGo(pos.coords.latitude, pos.coords.longitude),
            () => { gs.setScreen('hlobby'); },
            { enableHighAccuracy: true, timeout: 10000 }
          );
        }
        gs.startListeners(code);
      }} />}
      {state.screen === 'map' && <MapScreen state={state} onBack={() => gs.setScreen('hostrole')} onConfirm={handleConfirmTarget} findSmartTarget={gs.findSmartTarget} />}
      {state.screen === 'hlobby' && <HostLobbyScreen state={state} onBack={() => { gs.setScreen('land'); gs.goHome(); }} onStart={gs.lockStart} onToggleExcludeHost={() => gs.updateSettings({ excludeHost: !state.settings.excludeHost })} onShowQR={() => gs.setShowQRSheet(true)} onUpdateName={(n: string) => gs.setS({ myName: n })} />}
      {state.screen === 'hactive' && <HostActiveScreen state={state} onToggleView={gs.toggleMyView} onEnd={() => gs.setShowAbortSheet(true)} onToggleSound={gs.toggleSound} onToggleOrient={() => gs.toggleMapOrient('host')} mapOrientHost={gs.mapOrientHost} specRequests={gs.specRequests} onApproveSpec={gs.approveSpec} onDenySpec={gs.denySpec} onShowQR={() => gs.setShowQRSheet(true)} />}
      {state.screen === 'spectator' && <SpectatorScreen state={state} onLeave={gs.goHome} onToggleSound={gs.toggleSound} onToggleOrient={() => gs.toggleMapOrient('spec')} mapOrientSpec={gs.mapOrientSpec} />}
      {state.screen === 'join' && <JoinScreen state={state} onBack={() => gs.setScreen('land')} onJoin={(code, name, role, team) => gs.joinGame(code, name, role, team)} />}
      {state.screen === 'nwait' && <NavWaitScreen state={state} onBack={gs.goHome} />}
      {state.screen === 'nactive' && <NavActiveScreen state={state} onToggleSound={gs.toggleSound} onToggleView={gs.toggleMyView} onLeave={gs.goHome} onEnd={() => gs.setShowAbortSheet(true)} onRefresh={gs.sendPos} />}
      {state.screen === 'results' && <ResultsScreen state={state} onHome={gs.goHome} />}

      {gs.showCountdown && <CountdownOverlay num={gs.countdownNum} />}
      {gs.showArrive && <ArrivalOverlay onShowResults={gs.showResults} />}
      {gs.showEliminated && <EliminatedOverlay />}
      {gs.showSpeedWarn && <SpeedWarnOverlay onDismiss={gs.dismissSpeed} />}
      {gs.showAbortSheet && <AbortSheet onAbort={() => { gs.abortGame(); gs.setShowAbortSheet(false); }} onCancel={() => gs.setShowAbortSheet(false)} />}
      {gs.showQRSheet && <QRSheet code={gs.state.gameCode || ''} onClose={() => gs.setShowQRSheet(false)} />}
      <Toast msg={gs.toastMsg} visible={gs.showToast} />
    </div>
  );
}
