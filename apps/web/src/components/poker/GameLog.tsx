import React, { useEffect, useRef } from 'react';

interface GameLogEntry {
  type: string;
  payload: any;
  timestamp: number;
}

interface PlayerInfo {
  id: string;
  username: string;
}

interface GameLogProps {
  logs: GameLogEntry[];
  players: PlayerInfo[];
}

export const GameLog: React.FC<GameLogProps> = ({ logs, players }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getUsername = (id: string) => {
    const player = players.find(p => p.id === id);
    return player ? player.username : `Player_${id.substring(0, 4)}`;
  };

  const formatCard = (card: string) => {
    return card; // For now just return the string like "As"
  };

  const renderLogEntry = (log: GameLogEntry, index: number) => {
    const { type, payload } = log;
    let message = '';

    switch (type) {
      case 'POST_BLINDS_ANTES':
        return (
          <div key={index} className="space-y-1">
            <div className="text-white/40 text-[10px] italic">Blinds & Antes</div>
            {payload.smallBlind && (
              <div className="text-white/70">
                <span className="font-semibold">{getUsername(payload.smallBlind.playerId)}</span> posts small blind <span className="text-accent-2">${payload.smallBlind.amount}</span>
              </div>
            )}
            {payload.bigBlind && (
              <div className="text-white/70">
                <span className="font-semibold">{getUsername(payload.bigBlind.playerId)}</span> posts big blind <span className="text-accent-2">${payload.bigBlind.amount}</span>
              </div>
            )}
          </div>
        );
      case 'PLAYER_ACTION':
        const username = getUsername(payload.playerId);
        switch (payload.action) {
          case 'FOLD':
            message = `${username} folds`;
            break;
          case 'CHECK':
            message = `${username} checks`;
            break;
          case 'CALL':
            message = `${username} calls $${payload.amount}`;
            break;
          case 'RAISE':
            message = `${username} raises $${payload.amount}`;
            break;
          case 'ALL_IN':
            message = `${username} is ALL-IN for $${payload.amount}`;
            break;
          default:
            message = `${username} performs ${payload.action}`;
        }
        break;
      case 'DEAL_FLOP':
        message = `Flop: [${payload.cards.map(formatCard).join(' ')}]`;
        return <div key={index} className="text-accent-1 font-bold my-1">{message}</div>;
      case 'DEAL_TURN':
        message = `Turn: [${payload.cards.map(formatCard).join(' ')}]`;
        return <div key={index} className="text-accent-1 font-bold my-1">{message}</div>;
      case 'DEAL_RIVER':
        message = `River: [${payload.cards.map(formatCard).join(' ')}]`;
        return <div key={index} className="text-accent-1 font-bold my-1">{message}</div>;
      case 'WIN':
        message = `${getUsername(payload.playerId)} wins $${payload.amount} with ${payload.handName}`;
        return <div key={index} className="text-green-400 font-bold my-1">{message}</div>;
      case 'EARLY_WIN':
        message = `${getUsername(payload.winnerId)} wins $${payload.amount} (everyone folded)`;
        return <div key={index} className="text-green-400 font-bold my-1">{message}</div>;
      case 'UNCALLED_BET_RETURNED':
        message = `Uncalled bet of $${payload.amount} returned to ${getUsername(payload.playerId)}`;
        break;
      case 'HAND_INIT':
        return <div key={index} className="border-t border-white/10 my-2 pt-2 text-[10px] text-white/30 uppercase tracking-widest text-center">New Hand Started</div>;
      case 'PHASE_CHANGE':
        const phaseNames: Record<string, string> = {
          'PRE_FLOP_BETTING': 'Pre-Flop Betting',
          'FLOP_BETTING': 'Flop Betting',
          'TURN_BETTING': 'Turn Betting',
          'RIVER_BETTING': 'River Betting',
          'SHOWDOWN': 'Showdown'
        };
        const phaseName = phaseNames[payload.phase];
        if (!phaseName) return null;
        return <div key={index} className="text-white/40 text-[10px] font-bold uppercase tracking-wider mt-4 border-b border-white/5 pb-1">{phaseName}</div>;
      default:
        return null;
    }

    return (
      <div key={index} className="text-white/70">
        {message}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full max-h-[400px] w-full bg-surface/30 border border-white/10 rounded-xl overflow-hidden backdrop-blur-md">
      <div className="px-4 py-2 border-b border-white/10 bg-white/5 flex justify-between items-center">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/50">Game Log</h3>
      </div>
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-2 text-xs scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        {logs.length === 0 ? (
          <div className="text-white/20 italic text-center py-4">Waiting for action...</div>
        ) : (
          logs.map((log, i) => renderLogEntry(log, i))
        )}
      </div>
    </div>
  );
};
