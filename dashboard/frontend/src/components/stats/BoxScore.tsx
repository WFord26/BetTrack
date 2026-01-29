import React from 'react';

interface Team {
  name: string;
  abbreviation: string | null;
  logoUrl: string | null;
}

interface BoxScoreProps {
  homeTeam?: Team;
  awayTeam?: Team;
  homeScores: number[];
  awayScores: number[];
}

export default function BoxScore({ homeTeam, awayTeam, homeScores, awayScores }: BoxScoreProps) {
  const periods = Math.max(homeScores.length, awayScores.length);
  const homeTotal = homeScores.reduce((sum, score) => sum + (score || 0), 0);
  const awayTotal = awayScores.reduce((sum, score) => sum + (score || 0), 0);

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-xl font-bold text-white mb-4">Box Score</h3>
      
      <div className="overflow-x-auto">
        <table className="w-full text-white">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-4">Team</th>
              {Array.from({ length: periods }).map((_, i) => (
                <th key={i} className="text-center py-2 px-3 w-16">
                  {i < 4 ? `Q${i + 1}` : 'OT'}
                </th>
              ))}
              <th className="text-center py-2 px-3 w-16 font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {/* Away Team */}
            <tr className="border-b border-gray-700/50">
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  {awayTeam?.logoUrl && (
                    <img 
                      src={awayTeam.logoUrl} 
                      alt={awayTeam.name}
                      className="w-8 h-8 object-contain"
                    />
                  )}
                  <div>
                    <div className="font-semibold">
                      {awayTeam?.abbreviation || awayTeam?.name || 'Away'}
                    </div>
                  </div>
                </div>
              </td>
              {Array.from({ length: periods }).map((_, i) => (
                <td key={i} className="text-center py-3 px-3">
                  {awayScores[i] !== undefined ? awayScores[i] : '-'}
                </td>
              ))}
              <td className="text-center py-3 px-3 font-bold text-lg">
                {awayTotal}
              </td>
            </tr>

            {/* Home Team */}
            <tr>
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  {homeTeam?.logoUrl && (
                    <img 
                      src={homeTeam.logoUrl} 
                      alt={homeTeam.name}
                      className="w-8 h-8 object-contain"
                    />
                  )}
                  <div>
                    <div className="font-semibold">
                      {homeTeam?.abbreviation || homeTeam?.name || 'Home'}
                    </div>
                  </div>
                </div>
              </td>
              {Array.from({ length: periods }).map((_, i) => (
                <td key={i} className="text-center py-3 px-3">
                  {homeScores[i] !== undefined ? homeScores[i] : '-'}
                </td>
              ))}
              <td className="text-center py-3 px-3 font-bold text-lg">
                {homeTotal}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
