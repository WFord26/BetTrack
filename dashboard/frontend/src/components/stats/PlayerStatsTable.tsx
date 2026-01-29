import React, { useState } from 'react';

interface Player {
  id: number;
  firstName: string;
  lastName: string;
  position: string | null;
  number: number | null;
}

interface PlayerStat {
  id: string;
  playerId: number;
  stats: Record<string, any>;
  started: boolean;
  minutesPlayed: string | null;
  player: Player;
}

interface PlayerStatsTableProps {
  title: string;
  players: PlayerStat[];
}

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
} | null;

export default function PlayerStatsTable({ title, players }: PlayerStatsTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  if (!players || players.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">{title}</h3>
        <p className="text-gray-400">No player statistics available</p>
      </div>
    );
  }

  // Extract all unique stat keys from players
  const statKeys = Array.from(new Set(
    players.flatMap(p => Object.keys(p.stats))
  )).slice(0, 6); // Limit to first 6 stats for display

  const getStatValue = (player: PlayerStat, key: string): number => {
    const stat = player.stats[key];
    if (typeof stat === 'number') return stat;
    if (typeof stat === 'object' && stat !== null) {
      return stat.total || stat.yards || stat.points || 0;
    }
    return 0;
  };

  const sortedPlayers = React.useMemo(() => {
    const sorted = [...players];
    
    if (sortConfig) {
      sorted.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortConfig.key === 'name') {
          aValue = `${a.player.lastName}, ${a.player.firstName}`;
          bValue = `${b.player.lastName}, ${b.player.firstName}`;
        } else if (sortConfig.key === 'position') {
          aValue = a.player.position || '';
          bValue = b.player.position || '';
        } else if (sortConfig.key === 'started') {
          aValue = a.started ? 1 : 0;
          bValue = b.started ? 1 : 0;
        } else {
          aValue = getStatValue(a, sortConfig.key);
          bValue = getStatValue(b, sortConfig.key);
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return sorted;
  }, [players, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return current.direction === 'asc' 
          ? { key, direction: 'desc' }
          : null;
      }
      return { key, direction: 'asc' };
    });
  };

  const formatStatLabel = (key: string): string => {
    const labels: Record<string, string> = {
      passing: 'Pass',
      rushing: 'Rush',
      receiving: 'Rec',
      yards: 'Yds',
      touchdowns: 'TD',
      attempts: 'Att',
      completions: 'Cmp',
    };
    return labels[key] || key.charAt(0).toUpperCase() + key.slice(1);
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) {
      return <span className="text-gray-600">↕</span>;
    }
    return sortConfig.direction === 'asc' ? 
      <span className="text-blue-400">↑</span> : 
      <span className="text-blue-400">↓</span>;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-xl font-bold text-white mb-4">{title}</h3>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-white">
          <thead>
            <tr className="border-b border-gray-700">
              <th 
                className="text-left py-2 px-3 cursor-pointer hover:bg-gray-700/50"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  Player <SortIcon column="name" />
                </div>
              </th>
              <th 
                className="text-center py-2 px-2 cursor-pointer hover:bg-gray-700/50"
                onClick={() => handleSort('position')}
              >
                <div className="flex items-center justify-center gap-1">
                  Pos <SortIcon column="position" />
                </div>
              </th>
              {statKeys.map(key => (
                <th 
                  key={key}
                  className="text-center py-2 px-2 cursor-pointer hover:bg-gray-700/50"
                  onClick={() => handleSort(key)}
                >
                  <div className="flex items-center justify-center gap-1">
                    {formatStatLabel(key)} <SortIcon column={key} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map(player => (
              <tr 
                key={player.id}
                className="border-b border-gray-700/50 hover:bg-gray-700/30"
              >
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    {player.player.number && (
                      <span className="text-gray-500 text-xs w-6">
                        #{player.player.number}
                      </span>
                    )}
                    <span className={player.started ? 'font-semibold' : ''}>
                      {player.player.firstName.charAt(0)}. {player.player.lastName}
                    </span>
                  </div>
                </td>
                <td className="text-center py-2 px-2 text-gray-400">
                  {player.player.position || '-'}
                </td>
                {statKeys.map(key => (
                  <td key={key} className="text-center py-2 px-2">
                    {getStatValue(player, key) || '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
