% The 6 Cube · the oracle reasons in Prolog (run in the browser by Tau Prolog).
% Facts come from the visit: the hour (0-23), your rank (0 = the root) and how many times you came.
% The oracle answers with the first rule that fits, from the most specific to the most general.

part_of_day(H, deep_night) :- H >= 0, H < 5.
part_of_day(H, dawn)       :- H >= 5, H < 8.
part_of_day(H, day)        :- H >= 8, H < 18.
part_of_day(H, evening)    :- H >= 18, H =< 23.

voice(_, 0, _, 'The root returns. The rings are listening.').
voice(H, _, _, 'You came while the city sleeps. So did Diogenes, with his lantern.') :- part_of_day(H, deep_night).
voice(_, 1, V, 'An OG, back again. The cube remembers its first ring.') :- V >= 2.
voice(_, R, _, 'Far from the root, and still you arrived. Paths matter less than arrivals.') :- R >= 4.
voice(H, _, 1, 'First light, first visit. Turn one face and see what follows.') :- part_of_day(H, dawn).
voice(_, _, V, 'You keep returning. Perhaps the question is yours, not the cube’s.') :- V >= 5.
voice(H, _, _, 'Evening. The best questions arrive tired.') :- part_of_day(H, evening).
voice(_, _, _, 'Know thyself. Then ask the cube.').
