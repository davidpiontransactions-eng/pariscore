SUURJ: Seattle University Undergraduate Research Journal 
SUURJ: Seattle University Undergraduate Research Journal 
Volume 9 
Article 18 
2025 
Modeling and Predicting Momentum in Tennis Games 
Modeling and Predicting Momentum in Tennis Games 
Patrick Baldwin-McCurdy 
Seattle University 
Alexander Habib 
Seattle University 
Abey Joseph 
Seattle University 
Follow this and additional works at: https://scholarworks.seattleu.edu/suurj 
Recommended Citation 
Recommended Citation 
Baldwin-McCurdy, Patrick; Habib, Alexander; and Joseph, Abey (2025) "Modeling and Predicting 
Momentum in Tennis Games," SUURJ: Seattle University Undergraduate Research Journal: Vol. 9, Article 
18. 
Available at: https://scholarworks.seattleu.edu/suurj/vol9/iss1/18 
This Full-Length Research Article is brought to you for free and open access by the Seattle University Journals at 
ScholarWorks @ SeattleU. It has been accepted for inclusion in SUURJ: Seattle University Undergraduate Research 
Journal by an authorized editor of ScholarWorks @ SeattleU. 
169
Modeling and Predicting Momentum in 
Tennis Games
Patrick Baldwin-McCurdy, Mathematics
Alexander Habib, Mathematics
Abey Joesph, Mathematics
Faculty Mentor: 
John Carter, PhD, Mathematics 
Faculty Content Editor: 
Mark MacLean, PhD, Mathematics
Student Editor: 
Amelia Carey
170
Abstract

As if being the first Wimbledon winner in over 20 years whose name wasn’t Djokovic, 
Federer, Murray, or Nadal wasn’t enough, Carlos Alcaraz’s victory was even more astonishing 
considering he came back after being handily dealt with by Djokovic in the first set of the final 
1-6. Alcaraz’s miraculous recovery might be explained by a shift of flow in the game in his 
favor. In this paper, we compare two models that both interpret a small amount of past data 
within a given tennis match to determine which player has the current advantage, or “flow,” in 
the next game. We then analyze the data provided to us, determine the advantages one player 
may have over another, and use them to further enhance our models. Afterward, we discuss 
our findings and how our model could be improved. We finish by generalizing our model to 
predict what would change if the tournament was held on a different playing surface or if it 
was used in Women’s Professional Tennis.
171
Introduction
	
Tennis is a unique sport in the context of data analytics. Singles matches are one-on-one, 
and few statistics have any immediate face value. As higher levels of technical aptitude are 
reached, with physical attributes beginning to plateau, mental fortitude becomes increasingly 
important. Any psychological effect capable of significantly influencing a game could provide 
a player with an advantage that has the potential to shift the outcome of a match. The 
phenomenon of momentum is a salient example of such a psychological effect. Despite being 
identified by players and coaches alike, arguments for the existence of momentum and its 
impact on the game of tennis are met with skepticism from mathematical psychologists, such 
as Amos Tversky (Hale).
The Phenomenon of Momentum
	
Momentum, broadly speaking, is defined as “strength or force gained by motion or by a 
series of events” (“Momentum”). We are hesitant to use this definition, as concretely showing 
that the abstract concept of momentum exists is beyond the scope of our paper. Throughout 
the paper, we avoid giving a precise definition and, instead, investigate how we would expect 
it to affect the match being played, if the concept of momentum exists at all. Essentially, the 
aim of this paper is to see if local data describing the behavior of previous points can be used 
to predict the behavior of future points in a tennis match. If so, and we find a metric better 
than simply the number of points scored, we will be able to say that momentum at the very 
least likely exists.
Assumptions
	
We made the conscious decision to focus on points scored rather than elapsed time for 
determining the distance between data points. This decision has the benefit of making the 
spacing between events uniform; however, this also eliminates the impact rest breaks may 
have on how the flow of the game changes, which could be an important factor in stopping 
the opponent’s momentum. We also assumed that the server has an inherent advantage, which 
we justify by finding the probability that the server of a game wins in our given data set (Data 
Dictionary.csv.). 
The Data
	
The data we used were provided by the Consortium for Mathematics and its 
Applications (COMAP) as part of the 2024 Mathematical Contest in Modeling (MCM). This 
data included 31 matches from round three and forward of the Wimbledon Championship 
2023 tournament. Of the 31 matches, we had to exclude two (Elahi Galan v. Ymer & Pella 
172
v. Safiullin) as there was missing data from those matches that was required for our second 
model to function proficiently. We also chose to exclude the final three matches from any 
calculations made from the data set, as those games act as litmus tests to see how well our 
model predicts momentum outside of the given data set. All the data we had access to is in the 
appendix, which is the complete and unedited version from the Excel file we were given. 
Modeling Game Flow
Notation
	
Before introducing our model for game flow, we will introduce the notation that will be 
used throughout the remainder of this paper. As is the convention in programming, we will 
use zero-based indexing.
It is often useful to be able to combine data values from a particular set of rows corresponding 
to a match, set, or game. In such instances, we will specify a collection of rows P = {p0,...,p|P|} 
where pi is the ith row in the data set. Particular rows within a data set will be referred to as 
points. The column data associated with the point pi will be denoted as [column name]i. Refer 
to the appendix for descriptions and values of column data.
	
If a point is the winning point of a game or a set, it may be referred to as a game point or 
a set point, respectively. A point is realized as a game or set point if its game victor or set victor 
data is non-zero.
	
For data set P, we define the window of width k at a point pi to be the points {pmax{0,i−
k+1},...,pi}. Note that if i < k – 1, the first point in the window is p0.
	
A quick note on the graphs in the paper: when the function is negative, then player 
2 has the advantage, while the opposite is true if the function is positive. The dotted lines 
represent new sets, while the thin lines represent new games.
173
Flow and Cumulative Flow
	
To begin analyzing the idea of momentum, we must define a metric that we can use to 
showcase its effect. We propose a model for flow, which will describe the overall trajectory of a 
game. Flow will mainly be defined by the net points scored by a player, namely, the difference 
between how many points player 1 scored and how many points player 2 scored. According 
to Craig O’Shannessy, Novak Djokovic’s former statistician, only six players scored between 
52 and 55 percent of the points they played between 2015 and 2019 (Farthing). These six 
players won 18 of the 20 grand slam tournaments held in the five-year period. So, if the point 
differential between two opponents is small, what must really matter is when they score in 
the game. Thus, a cumulative points model, indexed against a per-point step, will provide an 
effective base for a model of game flow.
	
The models in this paper are focused on identifying the net performance of the two 
players (p1_points_won – p2_points_won). So, our convention is that positive measures are in 
favor of player one, and negative measures are in favor of player two.
	
To describe the flow of a match, we must first define the game flow step at the ith point 
in a match. So, considering the advantage that the server has, we define the flow step at pi to be 	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
(1)
where α = 0.1835 is the serving player’s advantage as 0.5 minus the probability that the server 
wins the point. This probability was computed using the data in COMAP’s “Wimbledon 
Featured Matches.Csv.” An example of a computation using the flow step is as follows: if 
player one is the server and scores at pi then point_victor = 1 and server = 1, so f(i) = (−1)0−
(0.1835) (−1)0 = 1−0.1835 = 0.8165. If player one is the server and player two scores, then point_
Figure 1 There are many ways to describe the flow of a match. Each undefined line in the graph represents a 
different window size for the models used (see Table 1).
174
victor = 2 and server = 1, so f(i) = (-1)1−(−0.1835)(−1)0 = −1−0.1835 = −1.1835. From this, we can 
see how server advantage is accounted for within flow steps. The flow step is the foundation of 
our match flow model, yet it provides little information about the net relative performance of 
the players. To further develop our model of the flow of a match, we define another metric that 
measures the relative performance of players within a window of points.
The k-flow step at pi is the sum of flow steps over the window of width k about the point pi and 
is denoted f(k)(i):
	
	
	
	
	
	
	
	
	
	
	
	
	
(2)
	
The k-flow step at a point pi can be interpreted as a measure of net performance in the 
last k points. Due to the k-flow step’s ability to measure local net performance, we recognize it 
as a model and call it the KFS model. 
	
The cumulative k-flow at pi is the sum of k-flow steps over {p0,...,pi} and is denoted Fk(i):
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
(3)
	
We define the flow of a match, up to a given point in the game k, to be the cumulative 
k-flow. To choose an appropriate value of k we plotted k functions over different k-values until 
the function was approximately smooth as seen in Figure 1. For the rest of this paper, the flow 
of a match at a point pi is defined to be the cumulative 18-flow and denoted simply as F(i). This 
is our baseline global metric for the flow of a match. For two points of a match pi and pj, where 
j > i, the change of flow between pi and pj is defined as
	
	
	
	
	
	
	
	
	
	
	
	
	
(4)
where sgn [absolute value ok](F(j) − F(i)) is the direction of match flow between the points.
Relationship Between Momentum and Flow
	
If the phenomenon of momentum exists and has an impact on player performance, then 
shifts in the net momentum of the players should affect the flow of the match. A shift in net 
momentum then manifests during points when the flow of the match shifts. If net momentum 
shifts in the favor of player one, then it would result in the flow of the game shifting to 
their favor. If momentum exists in an impactful way, then changes in net momentum can be 
detected by the local measure of performance that has an influence on global trends.
175
Scaling Momentum Model
	
The game of tennis is composed of five scales of play: matches, sets, games, points, 
and rallies. Each scale of play is composed of plays of lower scales. Matches are composed of 
sets, sets of games, games of points, and points of rallies. Accounting for player performance 
at different scales of play provides a more comprehensive picture of the game state. In this 
section, we outline the definition of a model to predict net momentum that accounts for the 
scales of play seen within the game of tennis. We will refer to the model described below as 
the Scaling Momentum model (SM model). Note that before, we defined “local” as a window 
of width k, much less than the total points scored in a match, |P|. Now, we can more formally 
describe k << |P| to mean that the width of the window is at most on the scale of games.
	
We describe our measure of performance at the point scale the same way as we do 
the flow, except we divide by shots. For the purpose of this paper, though, we will be calling 
the number of shots in a point the rally count, as that is the language that was used in the 
instructions for us during the MCM competition. This heuristic measure is based on the idea 
that two evenly matched players would keep playing forever once the server advantage was 
overcome. So, given a point pi, dividing (−1)point_victor−1 by rally_counti provides a measure for 
how the players are performing in comparison to each other. We can extend this heuristic 
argument to get a measure of net performance on the scale of games. Instead of dividing by 
rallies within a game, we divide by the number of points scored in a game and multiply by the 
minimum number of points to win a game.
	
Furthermore, we can account for advantages on different scales of play. In the definition 
of our flow steps, we account for server advantage for a given point α = 0.1835, but this is not 
the only advantage that is seen throughout the tennis game. On the scale of games, the server 
Figure 2 Cumulative k-flow for k = 1,2,7,12,17,18,22.
176
of a game is much more likely to win the game. The probability of the server winning the 
game was calculated using the Wimbledon data provided to be approximately 0.85458. So, the 
advantage of the server for a given game is γ = 0.35458.
	
In the following model, we combine the heuristic measures of net performance and 
account for advantages on the scales of points and games. The goal of the SM model is to 
integrate information that the KFS model does not account for in order to search for potentially 
unidentified factors.
	
Given a data set P let G be the index set of game points in P and let Wk(i) denote the 
index set of a window of width k at point pi in P. We define the k point moments as follows:
	
  	
                     	 	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
(5)
For gi,gi+1 
 G define |gi| to be the number of points won in the game point pgi. We can then 
define the k game moments as follows:
	
 	
	
	
	
	
	
	
	
	
	
	
	
	
	
(6)
It is important to note that the sum above requires both gi and gi−1 to be in G. We scale by a 
factor of 4 to account for the difference in scales and to ensure that game moments and point 
moments both have the same units. In both the point and game moments, we ensure that the 
units are appropriate by scaling by the minimum number of rallies to win a point or points to 
win a game. To combine the k game and point moments in equations (5) and (6), we simply 
average the two values:
	
	
 	
	
	
	
	
	
	
	
	
	
	
(7)
The final SM model measures the relative performance of the players, accounting for 
advantages on the scale of points and games.
	
Just as with our definition of flow, we define M(k)(i) to be a predicted cumulative 
measure of performance from the SM model. It may be referred to as a secondary game flow 
model:
	
	
	
	
	
	
	
	
	
	
	
	
	
(8)
We will use the cumulative SM model in a comparative analysis of the efficiency of the SM 
model and the KFS model.
177
Predicting Swings in Game Flow
	
Given a data set P where |P| = i, we say that a model provides a local measure of 
performance at pj where j ≤ i if it only depends on data within a window of width k << I, where 
k << i means that k is much less than i. In the section discussing scales of play, we note a more 
formal meaning of k << i. If all local measures of performance are ineffective at predicting 
the direction of the match flow, we can conclude that momentum likely does not exist in an 
impactful way. Conversely, if an accurate measure of local performance predicts the direction 
of the match flow, it is likely that momentum does exist and has an impact on the flow of the 
game.
	
Given a data set P, assume we know the data points p0,...,pi; we can think of pi as the 
current point. We can use the KFS model from (2) as a measure of local performance at pj. 
We define that µj = F(k)(j). We refer to this sum as the k-moments computed by a model. The 
k-moments identify which player is performing best at point pj. If µj > 0, then player one is 
performing better; if µj < 0, then player two is performing better; and if µj = 0, then the players 
are performing equally at pj. Then, let ∆sgn(µ) be the set of indices where the k-moments change 
signs; so, for j 
 ∆sgn(µ), the sign of µj is different than the sign of µj+1. 	
	
	
	
	
Given that changes in net momentum can be identified by a notable shift in a local 
measure of player performance, the points indexed by ∆sgn(µ) are candidates for changes in net 
momentum and consequently could be indicators of a future change in the direction of match 
flow. The change in match direction predicted by the KFS model is computed as 
sgn(µi − µilast) ilast = max{∆sgn(µ)}.
Figure 3 SM model flow change predictions vs. cumulative for Sinner v. Djokovic.
178
	
This method for making flow change predictions based on a model can be repeated for 
the SM model as such: given a data set P, assume we know the points p0,...,pi; we can think of 
pi as the current point. We can use the SM model as a measure of local performance at pj. We 
define that µj = {m(k)(j)}i
j=0. The points indexed by ∆sgn(µ) are candidates for changes in net 
momentum. The change in match direction predicted by the SM model is computed as sgn(µi−
µilast) ilast = max{∆sgn(µ)}.
Computing Accuracy of Predictions
	
The calculation of game flow is dependent on the k-flow steps, so the predictions made 
by the k-flow steps are reiterating information already known to the modeling of flow. Observe 
that the k-flow steps are a discrete difference of the cumulative k-flow steps. In our prior 
predictions we used the k-flow steps in a window to predict the flow of the match. However, 
these predictions can’t claim to demonstrate the existence of hidden information because the 
values the KFS model is predicting depend solely on the data it is using. In order to reveal 
the possibility of hidden information, we must find a model that outperforms the KFS model 
while utilizing information that is not captured by the KFS model.
Figure 4 KFS model flow change predictions for Sinner v. Djokovic.
179
	
We compare the effectiveness of the KFS model to the effectiveness of the SM model. 
The scaling momentum model factors in more information than the KFS model. If the scaling 
SM model can outperform the KFS model at predicting the flow of the match, this would 
strongly suggest that the SM model is exploiting hidden factors such as momentum. Wanting 
to test the accuracy of our model, we computed a prediction for the direction change in flow at 
the end of each game. Then we compared the direction predicted by the model to the direction 
of the flow between the next game’s points. We then took the average of the correct guesses 
across all game point predictions.
Figure 5 KFS model momentum shifts for Sinner v. Djokovic.
Figure 6 SM model flow change predictions for the Wimbledon semifinal match of Sinner v. Djokovic.
180
Model Comparisons
	
Table 1 describes the accuracy of the models. Accuracy was calculated by taking the sign 
of the flow prediction and comparing it to the behavior of the graph of cumulative flow at the 
point of the next prediction. 
	
The sign of flow change is how we measure the accuracy of our flow swing predictions. 
At the end of each game, we make a prediction of flow change based on the momentum of 
the game at the current point and the momentum at the last momentum change. The window 
for the prediction models has a notable impact on the relative accuracies if the window is 
exactly the length of the previous game. Since the game point from the prior game is used to 
compute the point count of the game point we are predicting from, the SM model’s accuracy is 
negatively impacted because it cannot compute the momentum change from the most recent 
game. Altering the SM model to count beyond the window would increase the range of data 
that the SM model has and thus give it an unfair advantage over the KFS model.
Figure 7 SM model momentum shifts for Sinner v. Djokovic.
Table 1 Model accuracy chart.
 Model Accuracy Chart
 
KFS Model
SM Model
Compared To Cumulative
KFS
SM
KFS
SM
Static Window, k=6
65.0%
65.5%
70.0%
75.0%
Dynamic Window, full game
68.0%
68.0%
63.0%
70.0%
 Dynamic Window, running average ppg
65.0%
65.4%
69.9%
74.5%
181
Model Analysis
Does Momentum Exist?
	
Our model seems to suggest that there is an advantage to winning points at certain 
moments, beyond what one would expect from a rudimentary model. This would indicate that 
a notion of momentum, as defined above, does exist.
Our Shortcomings and Feats
	
We would have liked to have included the ability for our model to predict who the 
overall match winner would be, as currently, the future accuracy window is a small one, but 
having the future window width be relatively small was a necessary condition for our SM 
model to work properly, so we made the decision not to expand it. Despite this, we believe 
our model answers the principal question being asked: are there any external factors beyond 
normal play that indicate the swings that happen during a tennis match?
Generalizing our Model
	
If we generalize our second model to include different types of tennis matches (e.g., 
different surface types) and we include Women’s Professional Tennis, Lisi et al. seem to 
suggest that our model would still perform well. Because our model considers rally count 
an important factor in determining the flow-state of the game, if the rally count for different 
surfaces is similar to that of grass, we would expect our model to perform just as well. The 
researchers calculated the mean rally length on hard surface to be 1.1875 times that of grass, 
Figure 8 SM model flow change predictions for the 2023 Wimbledon final, Alcaraz v. Djokovic. This shows the 
shift in momentum in favor of Alcaraz in the middle of the match.
182
with clay being 1.34375 times that of grass. Since the mean rally lengths for these surfaces 
are not just equal to but greater than they are for grass, we speculate that the longer the rally 
count, the more that flow would contribute to our model predicting a larger difference. Lisi 
et al. also shows that Women’s Professional Tennis has longer rally counts on average, which 
would again suggest our model would predict that flow would play a larger part in those 
games. So, we predict our model will perform just as well, if not better than it currently 
performs in a wide range of tennis matches. While very difficult to predict, our SM model 
would theoretically function if used in a game like table tennis as long as it was updated to 
account for the longer games and the updated server advantage coefficient. However, unlike 
predicting model accuracy when applied to different surfaces and leagues, it is much more 
difficult to predict whether the model will work when applied to table tennis. 
Enhancing our Model
	
We could expand upon the second model by having whole sets affect the momentum of 
a match, a more comprehensive version of what our current model does right now. We could 
also improve upon it by having more factors affect the weight of each point, as right now, only 
three more metrics are taken into account when compared with the KFS model.
	
Extending the SM model to the scale of sets may provide more detail regarding the 
underlying momentum gained from winning or losing a set. This idea can be extended further 
to the scale of sets, matches, and rounds in a tournament. However, since our goal is to identify 
changes in flow on a local scale within a match, we restricted our definition of the SM model 
to the scale of games. If we were to extend the SM model to larger scales of play, we could 
then calculate the advantages at those scales as well. Furthermore, with a more comprehensive 
understanding of the inherent advantages of a given game state (such as player one being 
a server) independent of player skills and prior game states, we could further refine the SM 
model to be more accurate in identifying shifts in player performance.
Acknowledgments
This paper is an edited version of a team contest entry in the Interdisciplinary/ Mathematical 
Contest in Modeling sponsored by the Consortium for Mathematics and its Applications 
(COMAP) at http://www.comap.org. All data are provided by COMAP.
183
Works Cited
“Data Dictionary.Csv.” Problems 2024 MCM-C, COMAP, Feb. 2024, https://www.mathmodels.
org/Problems/2024/MCM-C/data_dictionary.csv
Farthing, Tim. “Expert Analysis: ‘Winning Just 52% of Your Points Should Be Your Goal’ Says 
Novak Djokovic Tactician, Craig O’Shannessy.” Tennishead, 31 Mar. 2020, https://tennishead.
net/expert-analysis-winning-just-52-of-your-points-should-be-your-goal-says-novak-djokovic-
tactician-craig-oshannessy/
Hale, David. “Is Momentum Real? An In-Depth Investigation of Sports’ Most Overused Term.” 
ESPN, ESPN Internet Ventures, 22 Dec. 2021, www.espn.com/college-football /story/_/
id/32910904/is-momentum-real-depth-investigation-sports-most-overused-term.
Lisi, Francesco, et al. “On the Distribution of Rally Length in Professional Tennis Matches.” 
Research Gate, 20 Mar. 2023, https://www.researchgate.net/publication/369375375_On_the_
distribution_of_rally_length_in_professional_tennis_matches
“Momentum.” Merriam-Webster, 17 Feb. 2025, www.merriamwebster.com/dictionary/
momentum.
“Wimbledon Featured Matches.Csv.” Problems 2024 MCM-C, COMAP, Feb. 2024, www.
mathmodels.org/Problems/2024/MCM-C/Wimbledon_featured_matches.csv. 
184
Appendix
Table 2 The “Data Dictionary” given by COMAP.
Variables
Explanation
Example
match_id
match identification
2023-wimbledon-1701 (“7” is 
the round, and “01” the match 
number in that round)
player1
first and last name of the first player
Carlos Alcaraz
player2
first and last name of the second player
Novak Djokovic
elapsed_time
time elapsed since start of first point to 
start of current point (H:MM:SS)
0:10:27
set_no
set number in match
1, 2, 3, 4, or 5
game_no
game number in set
1, 2, ...,7
point_no
point number in game
1, 2, 3... etc.
p1_sets
sets won by player 1
0, 1, or 2
p2_sets
sets won by player 2
0, 1, or 2
p1_games
games won by player 1 in current set
0, 1,...,6
p2_games
games won by player 2 in current set
0, 1,...,6
p1_score
player 1’s score within current game
0 (love), 15, 30, 40, AD 
(advantage)
p2_score
player 2’s score within current game
0 (love), 15, 30, 40, AD 
(advantage)
server
server of the point
1: player 1, 2: player 2
serve_no
first or second serve
1: first serve, 2: second serve
point_victor
winner of the point
1 if player 1 wins, 2 if player 2 
wins
p1_points_won
number of points won by player
1 in match
0, 1, 2... etc.
p2_points_won
number of points won by player
2 in match
0, 1, 2... etc.
game_victor
a player won a game this point
0: no one, 1: player 1, 2: player 2
set_victor
a player won a set this point
0: no one, 1: player 1, 2: player 2
p1_ace
player 1 hit an untouchable winning 
serve
0 or 1
p2_ace
player 2 hit an untouchable winning 
serve
0 or 1
p1_winner
player 1 hit an untouchable winning 
shot
0 or 1
p2_winner
player 2 hit an untouchable winning 
shot
0 or 1
185
Variables
Explanation
Example
winner_shot_type
category of untouchable shot
F: Forehand,
B: Backhand
p1_double_fault
player 1 missed both serves and lost the 
point
0 or 1
p2_double_fault
player 2 missed both serves and lost the 
point
0 or 1
p1_unf_err
player 1 made an unforced error
0 or 1
p2_unf_err
player 2 made an unforced error
0 or 1
p1_net_pt
player 1 made it to the net
0 or 1
p2_net_pt
player 2 made it to the net
0 or 1
p1_net_pt_won
player 1 won the point while at the net
0 or 1
p2_net_pt_won
player 2 won the point while at the net
0 or 1
p1_break_pt
player 1 has an opportunity to win a 
game player 2 is serving
0 or 1
p2_break_pt
player 2 has an opportunity to win a 
game player 1 is serving
0 or 1
p1_break_pt_won
player 1 won the game player 2 is 
serving
0 or 1
p2_break_pt_won
player 2 won the game player 1 is 
serving
0 or 1
p1_break_pt_missed
player 1 missed an opportunity to win a 
game player 2 is serving
0 or 1
p2_break_pt_missed
player 2 missed an opportunity to win a 
game player 1 is serving
0 or 1
p1_distance_run
player 1’s distance ran during point 
(meters)
5.376, 21.384, etc.
p2_distance_run
player 2’s distance ran during point 
(meters)
6.485, 12.473, etc.
rally_count
number of shots during the point
1, 2, 4, etc. (includes serve)
speed_mph
speed of serve (miles per hour; mph)
81, 124, etc.
serve_width
direction of serve
B: Body,	BC: Body/Center,	
BW:
Body/Wide, C: Center, W: Wide
serve_depth
depth of serve
CTL: Close To Line, 
NCTL: Not Close To Line
return_depth
depth of return
D: Deep, ND: Not Deep
