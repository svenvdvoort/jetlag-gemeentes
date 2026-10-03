"""
Challenge text per card, generated from challenges.csv.

Do not edit by hand - run `python -m scripts.import_challenges` instead.
Cards are in deck order (GEMEENTES, then WILD_CARDS) and every card in
the deck has an entry, so an empty title, description or link means the
sheet itself is still empty there.
"""

from typing import Dict

from app.game_data import Challenge

CHALLENGES: Dict[str, Challenge] = {
    'Aalten': Challenge(
        title='Make a long sentence',
        description='Did you know that Aalten is only the third gemeente of the NL in alphabetical order? Such a fun fact! In Aalten lies the city of Bredevoort, nicknames the Boekenstad. Make a 20 word long grammatically correct sentence using words you find on objects around you. No two words may come from the same sign / piece of text. To help you start you get the first word for free: "JetLag". You may do this challenge anywhere in Aalten.',
        link='',
    ),
    'Almelo': Challenge(
        title='Find something to do',
        description='Film a traffic light changing to red, and then within 10 seconds a different traffic light changing to green.',
        link='https://youtu.be/63f2xQTuQ3g',
    ),
    'Apeldoorn': Challenge(
        title="Get Deutsche Bahn'ed",
        description='Travel on a delayed train. Only one person has to travel by train. The challenge is complete once the entire team is back in the car.',
        link='',
    ),
    'Arnhem': Challenge(
        title='Be your own DSO',
        description='Power a light next to a MSR (middenspanningsruimte). Transmit power from the AA battery to the LED using your own conductor. You may not use any conductors you already have.',
        link='',
    ),
    'Barneveld': Challenge(
        title='Chicken darts',
        description="Barneveld is famous for its chicken, but also for the darts player Raymond van Barneveld. Go near a place in Barneveld that has chicken (real chicken, dead or alive) or eggs. One of you will become Raymond, a precise thrower, they will be handed a ball and put on a blindfold. The other two players are the chicken, they walk around Raymond in circles (at a steady pace, don't stand still) at a distance of at least 5m while making chicken sounds. Raymond then gets 10 attemps to shoot his dart (ball) at both of the chicken. If Raymond does not succeed (that is, hits both of the chicken) in 10 tries, someone else becomes Raymond and the new Raymond tries again.",
        link='',
    ),
    'Berkelland': Challenge(
        title='',
        description='Berkelland was named after the Berkel, which was used as a major shipping route between Germany and the Netherlands. The river was crossed using the so called Berkelzompen. Honor this tradition by going to the Berkel anywhere within Berkelland and go on to build your own Berkelzomp. Using only materials you can find nearby, build a boat that can carry Larry. Place it in the water and make it travel 10 metres without Larry sinking and you touching the boat. Larry is a rock of at least 3 cm in any direction, he should have a face and his name written on him.',
        link='',
    ),
    'Borne': Challenge(
        title='This is Ilse de Lange',
        description='Go to the Openluchttheater Hertme and recognize a song by Ilse de Lange. Look up the playlist "This is Ilse de Lange", and put it on shuffle. Guess the title of the song in 1 try. If you get it wrong, you have to listen to the whole song and can retry at the next song.\nBackground: I would\'ve placed this challenge in Almelo since that\'s more iconic for Ilse but Dany beat me to it.',
        link='https://metropool.nl/agenda/ilse-delange',
    ),
    'Bronckhorst': Challenge(
        title="Recreate Giovanni's goal",
        description='In the semifinals of the men\'s soccor world championship, Giovanni van Bronckhorst scored his furthest goal ever, from 37 meter, which helpen us beat Uruguay 3-2. Find a goal that is unmistakenly used to play soccer. Each team member must score their own Van Bronckhorst "Magical Goal" from a distance of 37 meters. If you haven\'t succeeded within 20 minutes of entering Bronckhorst (because you haven\'t found a good goal), you may make your own goal that is 7.32m wide and 2.44m high and use that.',
        link='https://www.youtube.com/watch?v=JVQmWZoNHG4',
    ),
    'Brummen': Challenge(
        title='Brum Brum komt eraan',
        description="Of course we all know Brum, and since we're in Brummen (multiple), you're challenge is simple: find three parked yellow cars.",
        link='',
    ),
    'Dalfsen': Challenge(
        title='30 seconds of Dalfsen!',
        description='Get a perfect score on 30 seconds. Go the site below and use the standard difficulty. Take turns explaining the words to your teammates. Keep going until you get 5/5 words on a turn. You are not allowed to skip turns.',
        link='https://30secondenspel.nl/',
    ),
    'Deventer': Challenge(
        title="You're in the Snackzone",
        description='You\'re in the snackzone! Get yourself some Deventerse "Bijtjes" and review them snackzone style. Make sure you edit a nice banner of course and send the video in the group chat. (p.s. since not everyone is a burger with corresponding money yet, you are allowed to find original bijtjes, take a photo with them, and then do the challenge with a cheaper alternative)',
        link='',
    ),
    'Dinkelland': Challenge(
        title='From safe to unsafe',
        description='In 2018 Dinkelland was named the safest municipality of the Netherlands, much has changed in 8 years. Prove how unsafe Dinkelland is. Find 5 different triangular warning signs and take a picture of each one. Each sign must show a different warning. Clarification: two different drawings on a traffic sign count as two distinct warnings.',
        link='',
    ),
    'Doesburg': Challenge(
        title='',
        description="Doesburg has the oldest weighhouse in NL (De Waag from 1478), so let's see how good you are at weighing! Go to the Waag in Doesburg, put a blindfold on 1 of your teammates. Take 2 identical full water bottles, take ONLY 2 sips out of one bottle, shuffle them, and place 1 in each hand. Holding arms straight out, the scale must guess which bottle is heavier. The scale must get it right 3 times in a row.",
        link='',
    ),
    'Doetinchem': Challenge(
        title='DOS',
        description='Doetinchem created the DOS (Doetinchem en OntwikkelingsSamenwerking) with its sister cities La Libertad in Nicaragua and Pardubice in the Czech Republic.\n\nNow create your own DOS: Dribble, Obstacle, Score!\n\nFind an object starting with D and Dribble it (like a soccer player) past an Obstacle starting with O, then Score by getting it into a goal made from something starting with S.\n\nFor example: dribble a Door past an Octopus and score in a goal made of Solar panels.\n\nFilm your attempt from start to finish.',
        link='',
    ),
    'Duiven': Challenge(
        title='',
        description='Capture duiven in Duiven. Take a picture of two or more pigeons in the same photo. The pigeons must be at most 5 meters away from you, and two pigeons at most 5 meters apart.',
        link='',
    ),
    'Ede': Challenge(
        title='Ede or Epe',
        description='Play "Ede of Epe". Go to a sign that says \'Welkom in Ede\' or \'Gemeente Ede verwelkomt u\', or similar (you may park at a safe distance from it, but get as close to the sign as possible). One teammate Googles either Ede or Epe randomly (use a die or something) and read out a statement, news article headline, etc. For example: "Gemeente Ede or Epe has 125.000 inhabitants". The other teammates must guess which one it is. Play this game for 4 rounds, you must get 3 correct. If you fail, you must go to another \'Welkom in Ede\' sign to play another 4 rounds. You may not do research beforehand. You also may not switch roles. If you have done this challenge in Epe, stick to the same roles.',
        link='',
    ),
    'Elburg': Challenge(
        title='ABCD Elburg',
        description='Kinda weird that Elburg starts with an E right? On the topic of ABCtjes: Create an "ABCtje" with only the names of programming languages. Names of esotoric languages are allowed. You can look up names of languages you do not know yourself, but this costs 1 minute per letter that you covered this way. The penalty minutes start after you’re done with the list. You have claimed Elburg when you have a full list and waited out all of your penalty minutes. Brainstorming may start after you park your car in Elburg.',
        link='',
    ),
    'Enschede': Challenge(
        title='',
        description='PLOP! Enschede is where Grolsch is brewed with its iconin plopping bottle caps. Each team member must perform 1 unique way to create a PLOP sound.',
        link='',
    ),
    'Epe': Challenge(
        title='Ede or Epe',
        description='Play "Ede of Epe". Go to a sign that says \'Welkom in Epe\' or \'Gemeente Epe verwelkomt u\', or similar (you may park at a safe distance from it, but get as close to the sign as possible). One teammate Googles either Ede or Epe randomly (use a die or something) and read out a statement, news article headline, etc. For example: "Gemeente Ede or Epe has 34.000 inhabitants". The other teammates must guess which one it is. Play this game for 4 rounds, you must get 3 correct. If you fail, you must go to another \'Welkom in Epe\' sign to play another 4 rounds. You may not do research beforehand. You also may not switch roles. If you have done this challenge in Epe, stick to the same roles.',
        link='',
    ),
    'Ermelo': Challenge(
        title='Waterchallenge',
        description='In september Ermelo organised the 7dagenwaterchallenge, so you will do a water challenge as well! All team members fill their mouth with water. Then watch the whole video in the link below without spitting out or swallowing any water. If you fail, you must return to the start of the video and try again.',
        link='https://www.youtube.com/watch?v=U3ipGb_IOVA',
    ),
    'Haaksbergen': Challenge(
        title='Haaksbergen Frikandellen Challenge',
        description='9 months ago a beautiful video appeared on YouTube of a guy trying to eat 20 frikandellen in De Vester in Haaksbergen. He only gets to 12. Prove that you are a worthy competitor by eating 4 frikandellen at De Vester or 3 frikandelbroodjes (from a supermarket, but then eat them near the De Vester). Only one teammate does this challenge.',
        link='https://www.youtube.com/watch?v=Rpo4WrP16n8',
    ),
    'Hardenberg': Challenge(
        title='',
        description='Did you know Hardenberg has almost 50 churches? Go to a church and guess when it was built. You can be a maximum of 100 years of. If you fail, find a different church',
        link='',
    ),
    'Harderwijk': Challenge(
        title='Help Professor Fetze Alsvanouds!',
        description='In the Dutch TV series *Het Klokhuis*, Aart Staartjes played a professor in several sketches: Professor Fetze Alsvanouds, who claimed to hail from the prestigious “University of Harderwijk.” The only problem? Harderwijk hasn’t had a university since 1811! Nevertheless professor Fetze Alsvanouds needs your help to prove a theory: The higher you are the faster you can eat an apple!\nTake a picture where one of you is higher than the other and has an apple fully eaten with only *Het Klokhuis* (the core) remaining while the lower person is still busy eating their apple.',
        link='',
    ),
    'Hattem': Challenge(
        title='',
        description='Hattem is home to the one and only museum fully dedicated to Anton Pieck! As you know, Anton Pieck is behind the designs of a lot of the art of the fairy tales in the Efteling! Go to the Anton Pieck museum (no need to go inside), and act out and draw different fairy tales that can be found in the Sprookjesbos. Each round of guessing the members of your team have different tasks: person #1 acts out a fairy tale without talking, person #2 guesses the fairy tale silently and draws it, person #3 only sees the drawing and uses that to guess what fairy tale person #1 acted out. If person #3 guesses incorrectly, you may try again with a different fairy tale. You have completed the challenge when 5 fairy tales have been guessed correctly.',
        link='',
    ),
    'Heerde': Challenge(
        title='',
        description='Ach heerde, heerde is truly heerdelijk. Known for its nature, hiking paths and recreational possibilities it is the perfect place to take a bit of a break from all the stressful, fast paced challenges and touch some grass. Sit down together and stay entirely silent for at least 5 minutes. You must gauge yourself how long that is, without consulting a timer. If you end up speaking before the 5 minutes are over you can try again immediately.',
        link='',
    ),
    'Hellendoorn': Challenge(
        title='Have fun in Hellendoorn',
        description='This place is "famous" for the equally named adventure park. Find a fun place and have fun for 15 minutes. You are not allowed to strategize during this time.',
        link='',
    ),
    'Hengelo': Challenge(
        title='',
        description='Hengelo is the very last station many Germans see before crossing the border with Deutsche Bahn. Because of that there is also a lot of German tourists, that are looking for sights. Two members must be able to spell some of the common sights that a tourist might look for in German. In total they must spell 5 words correctly. When they spell one word wrong they must wait 1 minute before attempting to spell another one. Nina is obviously not allowed to be one of the spelling people. A list of suitable sights/words can be found in the "Bijlagen challenges" folder.',
        link='https://docs.google.com/document/d/1MYMs6wRbnxOxjLlWqw2Gqu9rvuD8k6E_aqoXYAvXv9E/edit?tab=t.0',
    ),
    'Hof van Twente': Challenge(
        title='Find Twents',
        description='Find a sign exclusively written in the Twents dialect, and translate it successfully to English. If you fail you can try again with a different sign.',
        link='',
    ),
    'Kampen': Challenge(
        title='',
        description="Time to go kamperen! Build a 'tent'. The tent must stand on its own for at least 10 seconds and fit at least one person lying down! Your tent does not need any doors or floors, but it must fully cover the person. Moreover, the person lying in the tent doesn't want to touch the tent, otherwise it would be a dekentje.",
        link='',
    ),
    'Lochem': Challenge(
        title='',
        description='One of the things that can be found in Lochem is de dikke boom van Verwolde. This oak tree is estimated to be around 700 years old, what a long way for a tree to stand. All the members in your team must form a forest by holding the tree yoga position together for two consecutive minutes. If one of you fails you must try again. You may lean on each other for support.',
        link='',
    ),
    'Losser': Challenge(
        title='Get the hips Losser',
        description="It's time to get the hips a little Losser :) Learn the line dance to Cotton Eye Joe from the video below. When you all think you've got it down, dance flawlessly from 0:08 - 0:38 of Cotton Eye Joe by Rednex on Spotify.",
        link='https://www.youtube.com/watch?v=6_oP3YPpIC4',
    ),
    'Montferland': Challenge(
        title='Fortress of Solitude',
        description="Visit Kasteel Huis Bergh, the largest medieval castle in the Netherlands! It's also right on the border with Germany. I imagine living in such a huge mansion can get lonely at times. Luckily you could then always play 'Solitaire' with a deck of cards. Complete this challenge by completing a game of solitaire, playing strictly according to the rules of this video (3 cards from the stock at once, you can reuse the stock but cannot reshuffle!). If the game is impossible to complete, start over with a new game of solitaire.",
        link='https://www.youtube.com/watch?v=oAB5fsN2uA8',
    ),
    'Nijkerk': Challenge(
        title='Frequency! Oh no Wavelength',
        description='Play Wavelength at https://mikeck1.github.io/. Every round you play 3 games: every team member can say a category, while the other two guess. This challenge succeeds if you earn 10 or more points in total during one round of 3 games. If you earn less points, you have to wait 7 minutes before trying again. You can practise before a real attempt, but not with the same categories as during the real attempt!',
        link='https://mikeck1.github.io/',
    ),
    'Nunspeet': Challenge(
        title='GeoCache',
        description="Charlotte's aunt and uncle are from Nunspeet and they love to do GeoCaches. Find a GeoCache.",
        link='',
    ),
    'Oldebroek': Challenge(
        title='Walk like Wolbert',
        description='Legend tells of Wolbert, a giant from Oldebroek. He was so enormous that his footsteps and clogs were said to have shaped the landscape around Wezep. Wolbert was a giant and could easily step over people. \nOne of you becomes Wolbert. Walk 100 metres with each step stepping over another teammate.',
        link='',
    ),
    'Oldenzaal': Challenge(
        title='Expeditie Robinson',
        description='Did you know that Carlos Platier Luna, the winner of Expeditie Robinson 2017 is from Oldenzaal? To celebrate this, go to a playground and perform an Expeditie Robinson proef: one teammate hangs from a bar without touching the floor for one full minute. If you fail, you may try again after 10 minutes. You may not practice.',
        link='',
    ),
    'Olst-Wijhe': Challenge(
        title='',
        description="Olst-Wijhe is home to De IJssellinie, a top-secret 50s Cold War defense line filled with bunkers along the IJssel. Troops in observation posts had to transmit secret intel in a way so the Soviets would not be able to intercept them. And the ideal way to do this is charades (hints)!\n\nStand 30 meters apart in an open area in Olst-Wijhe. Teammate 1 acts out a secret word from the medium category of the link below using only their body. Teammates 2 and 3 stand 30 meters away and must shout out the correct answer. You may guess infinitely many times, but if the actor wants to change the word they're acting out, the penalty is 1 minute. Each teammate has to act out one secret word succesfully.",
        link='https://randomwordgenerator.com/charades.php',
    ),
    'Ommen': Challenge(
        title='Build a diorama',
        description='Ommen is a popular tourist destination, famous for its campsites and bungalow parks. But it is also home to a unique piece of Dutch cultural heritage: the National Tin Figure Museum. The museum brings history to life using tiny tin figures, depicting everything from large-scale battles to intricate everyday scenes.\nYour challenge: create your own diorama! You may do this anywhere in the gemeente. \n\nYour scene must:\nContain at least 3 clearly humanoid characters.\nShow the characters doing something together.\nInclude at least 2 objects that the characters are interacting with or using.\nBe entirely handcrafted from whatever materials you can find.\n\nOnce your masterpiece is complete, take a picture of your diorama as proof of your artistic achievement!',
        link='',
    ),
    'Oost Gelre': Challenge(
        title='Adt Grolsch in Grolle',
        description='Honour the origin of Grolsch by adting a (0.0%) beer of at least 33cl.',
        link='',
    ),
    'Oude IJsselstreek': Challenge(
        title='Attracted to the iron',
        description="Oude IJsselstreek was once at the heart of the Dutch iron industry and that iron heritage can still be found everywhere. Find 5 different magnetic objects and attach a magnet to them. Each object must serve a different function and be found at a different location. For example, two traffic signs at different locations still count as only one type of object. (Please take the magnets with you again and don't leave them there)",
        link='',
    ),
    'Putten': Challenge(
        title='A put in putten',
        description='Dig a put (aka a well). The put must be at least 10 cm deep and at least 10 cm in diameter. Fill the put with at least 500 ml of water.',
        link='',
    ),
    'Raalte': Challenge(
        title="Protect the rooster's egg",
        description="Stöppelhaene is Raalte's famous harvest festival, and its symbol is the rooster. Protect the rooster's egg! Build an egg-protection device and drop an egg from 3 metres without it cracking. The device must be attached to the egg and the floor the egg is dropped on must be either concrete or stone. In other words don't put a matrass below the egg.",
        link='',
    ),
    'Renkum': Challenge(
        title='',
        description="What's a famous monument of Renkum? The Renkum windmill of course. Build a 'windmill' yourself! What would this look like? It doesnt matter, as long as it can spin at least 5 times through windpower alone (blowing it is obviously allowed)",
        link='',
    ),
    'Rheden': Challenge(
        title='Become a brickworker',
        description='In 1867, Rheden had six brickworks employing more than 400 people. Continue the tradition! Build a wall using only stones, bricks and pebbles you can find nearby. You must build your wall in the forest and it must be at least 2 meters long. While building, each person may only carry one stone/brick at the time.',
        link='',
    ),
    'Rijssen-Holten': Challenge(
        title="It's five o'clock somewhere",
        description='Don\'t you also love reizen and hollen? When travelling, you often end up in a different time zone. Play "It\'s five o\'clock somewhere", one teammate generates times that it is around the world, the other two teammates guess where it is that time. You get six tries an must get at least three correct. If you don\'t get three correct guesses, you must wait 12 minutes to try again. Alternatively, if you don\'t want to wait 12 minutes, you can also choose to go \'hollen\': have one teammate run 1km. You may not study. After a failed attempt, so after the full 6 guesses, the actual times of your incorrect guesses may be revealed.',
        link='',
    ),
    'Rozendaal': Challenge(
        title='A Rose for Rozendaal',
        description="Rozendaal is one of the wealthiest municipalities in the Netherlands, with the third-highest concentration of millionaires in the country. Of course, you want to be rich too!\nYour challenge: become a millionaire. Find a local resident, confess your love to them, and offer them a rose, your rose may either be a rose or a crafted. Please remain respectful tot the residents, if they indicate they don't want to partake don't push them to win the challenge. Take a picture of the romantic moment as proof.",
        link='',
    ),
    'Scherpenzeel': Challenge(
        title='Build a city',
        description="(Re)build a livable city. Go to the statue of three men carrying wood in the center of Scherpenzeel. Just like they are rebuilding what was once destroyed, two of you will build a city. Use only items you find around you and not more than 3 items from your bag, you must build a house, church, school, hospital and a shop. The third teammate must then correctly guess which building is which. If they guess incorrectly, you may try again after 10 minutes, but with 3 different items then before. Some rules: if, hypothethically, you use teammate #1's water bottle as one of the items, you may not use teammate #2's water bottle in a second try, those would be the same item. Furthermore, you may not prepare for this challenge by packing something for it.",
        link='https://standbeelden.vanderkrogt.net/object.php?record=GL45ab',
    ),
    'Staphorst': Challenge(
        title="Find a 'levensboom'",
        description="A 'levensboom' is metal ornament that is found above the front door of farms in Staphorst. It is said to indicate that one of the daughter living at the farm is still single and potentially looking for a husband. Nowadays however, it also serves as decoration and break in prevention. Find a house with a 'levensboom' and (respectfully) photograph it.",
        link='https://nl.wikipedia.org/wiki/Levensboom_(bouwkunde)',
    ),
    'Steenwijkerland': Challenge(
        title='The Dutch Venice',
        description='Steenwijkerland is home to Giethoorn also known as the Dutch Venice, where the streets are canals and boats are the way to travel. Build your own Venetian vessel! Create a paper boat, that is able to float on the water for at least 2 minutes.',
        link='',
    ),
    'Tubbergen': Challenge(
        title='Hobby horsing',
        description='In Geesteren in Tubbergen the concours hippique takes place every year, an obviously well known horse show jumping competition. In the spirit of the concours hippique take on hobby horsing. Using sticks as a substitute for the hobby horse create a 3 minute video of your attempt. This activity must include all three group members, and most include elements of horse jumping and dressage. The video must also be shared with the other groups.',
        link='',
    ),
    'Twenterand': Challenge(
        title='Become a Rusluie merchant!',
        description='For almost 200 years, the Rusluie of Vriezenveen (old name of Twenterand) traded with St. Petersburg. Some of the most important trades were fabric, wine, tea, and flowers. Each of these items bought and sold among many of the stores on the route. For your challenge you must become a Rusluie merchant! For each of the 4 mentioned items (fabric, wine, tea, flowers) find a store that sells them and take a picture. You may not go to the same store twice, so no photographing tea and wine in the same Albert Heijn. For fabric: rugs and clothes count as well.',
        link='',
    ),
    'Voorst': Challenge(
        title='Play a game of polder',
        description='Voorst has one of the oldest polders of the Netherlands (Polder Nijbroek). To honor this play a game of polder.',
        link='https://docs.google.com/document/d/1pVMtJQrpE79wh0fUOQquFZIXrcAa_AUNRNxX-j4kqLI/edit?tab=t.0',
    ),
    'Wageningen': Challenge(
        title='Farming in Wageningen',
        description="Wageningen university is known for its agricultural expertise. On Wageningen campus be your own farmer: Acquire pits from 3 different fruits or vegetables and plant them somehwere on the campus. Make sure to return in 5 years to see your fully grown apple/prume/tomato/grape/etc tree! (Please do this challenge respectfully; I'm sure the university will appreciate if you don't destroy their green lawn.)",
        link='',
    ),
    'Westervoort': Challenge(
        title='Cocktail challenge',
        description="You all know our great friends Lucy Westerweel and Sven van der Voort. If you mix their last names, you get Westervoort. Speaking of mixing, do you like cocktails? Charlotte is sad she didn't get to do the cocktail challenge last time so here it is again:",
        link='https://docs.google.com/document/d/1PpmpzOUY6Ez6c3vvfC7sk6IbXre69pUoAz67b3Yb6HA/edit?usp=sharing',
    ),
    'Wierden': Challenge(
        title='Wierden Wikipedia',
        description='Wierden starts with a W. You know what else starts with a W? Wikipedia! Go to the Wierden city hall and play the Wikipedia game. By only clicking on the blue links inside the wikipedia pages (starting on Wierden) go to the wikipedia page for: Jetlag! (The time difference sleepy kind, not the game ;p) You are not allowed to google/look at wikipedia pages for extra information on the side and you are not allowed to go back.',
        link='',
    ),
    'Winterswijk': Challenge(
        title='',
        description='Mondriaan spent his youth in Winterswijk. Create a Mondriaan artwork. All materials must be gathered on location (e.g. leaves, twigs, stones); you may not use any items you already had with you. Construct a grid with at least one red, one yellow and one blue item. Take a photo and send it in the group chat as proof.',
        link='',
    ),
    'Zevenaar': Challenge(
        title="Seventh time's the charm",
        description='Find a tossable piece of food and stand at least 4 metres apart.\nYour challenge: toss the food directly into your teammate’s mouth 7 times!\nThe food must go straight from the thrower’s hand into the catcher’s mouth, and you must remain at least 4 metres apart for every attempt.\nRecord the entire challenge on video as proof.',
        link='',
    ),
    'Zutphen': Challenge(
        title='',
        description="Did you know Zutphen is home of the one and only public 'Kettingbibliotheek', where the books were chained to the church benches to prevent thieves! While this is really cool, the library is unfortunately closed today :( Go to the church to admire it from the outside, and that create your one chain reaction! create a chain reaction that causes at least 5 separate objects to move,\nand ends by knocking over / touching a designated object. You may not touch any object after starting the reaction. You have as many tries as you want",
        link='',
    ),
    'Zwartewaterland': Challenge(
        title='',
        description='Genemuiden in Zwartewaterland is the Netherlands\' "Carpet Capital" (Tapijtstad). Place a big cloth like a towel or picnic blanket (carpet ;)) on the ground. 2 teammates stand on it while the third pulls the carpet 5 meters. The teammates on the carpet may never touch the ground. If they do, restart from 0m! You may do this challenge in Haselt, Zwartsluis or Genemuiden.',
        link='',
    ),
    'Zwolle': Challenge(
        title='Zwolleywood',
        description='Welcome to Zwolleywood! Here you will recreate one of the coolest movie scenes (the cool part starts at 5:00 of the video). Find a white house for an appropriate background. Throw a card around without anyone in the neighbourhood noticing. Each of the duos in your team must complete one pass at 5m from each other without being seen.',
        link='https://www.youtube.com/watch?v=pBs_nwDAr1c',
    ),
    'Pieterpad Wild Card': Challenge(
        title='Walk the Pieterpad',
        description='The Pieterpad is indicated by white and red markings along the path. Start from one of these markings and choose a direction to go into. Follow the Pieterpad with at least two teammembers until you have seen markings at 7 different cross-roads*. If at any point during this challenge one of the team members takes a wrong turn, the challenge is failed, so stay together. You may not use your phone to find the way. If you fail, you may retry in a different gemeente. \n*At some cross-roads you may find multiple signs that indicate both the correct and incorrect road to take, those count as one.',
        link='',
    ),
    'Nationale parken Wild Card': Challenge(
        title='Brandnetel thee',
        description='At these beautiful national parks, we must appreciate one of the most common plants here in the Netherlands: The nettle! Make nettle tea (or brandnetel thee). Use at least 3 nettle leaves and boiling hot water of course. No need to take a sip ;) As an exception for Steenwijkerland, you may obtain ingredients (other than the nettle itself) from a neighbouring gemeente.',
        link='',
    ),
    'Burger King Wild Card': Challenge(
        title='Eat a burger',
        description='Go to a Burger King, leave one teammate blindfolded outside. The other two team member order a burger randomly (use a random number generator). The burger may come from the whole menu, but it must be a burger. The blindfolded person must then taste the burger and recognise which one it is. They may consult the ordering machine inside. They have one guess. If the guess is incorrect, you can try again in a different Burger King.',
        link='',
    ),
    'Station Wild Card': Challenge(
        title='Connect two clusters',
        description="With this card, you don't only earn a gemeente, but you can connect two clusters that were not connected before, kind of like the station in Ticket to Ride. One team member takes the train from one gemeente to another, where the following rules apply: the destination must lie in a gemeente that you have already claimed; the departure must lie in a gemeente that is not claimed by anyone yet AND is not connected to the cluster of the destination gemeente. After picking the teammate up, the gemeente of departure is claimed and the two gemeentes (which are not physically connected to each other) are now connected for you. This won't show in the webapp so nicely inform the other teams please.",
        link='',
    ),
    'Intratuin Wild Card': Challenge(
        title='',
        description='You get three tries per Intratuin. Everyone must choose either a red, yellow, white or pink flower. The goal is that each of you choose a different color. You cannot communicate or strategize in any way. If you fail you can try again in a different intratuin.',
        link='',
    ),
    'Kinderboerderij Wild Card': Challenge(
        title='Sculpt an animal',
        description='Today is Animalday! Go to a kinderboerderij that has at least cows. Two of the teammembers must find an animal (but not a cow) and sculpt it in butter. You have three minutes to create your masterpiece from the time you start working on it. The other teammate must succesfully guess which animal was sculpted. If you fail, you can only retry this in a different gemeente.',
        link='',
    ),
}
