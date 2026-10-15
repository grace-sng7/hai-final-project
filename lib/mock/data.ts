import trip from '../fixtures/trip.json';
import laptop from '../fixtures/laptop.json';
import apartment from '../fixtures/apartment.json';
export const laptopCorrection = 'I make $1,800/month after tax and spend $1,300/month. I need the laptop in 4 months.';
export const samples = [
 { id:'trip', title:'Europe trip', icon:'✈', message:'I make $2,000 a month after tax. Rent is $900 and other spending is about $750. I have $1,200 saved, but don’t want to use it all. Can I afford a $3,000 Europe trip with friends in 8 months?', data:trip },
 { id:'laptop', title:'A new laptop', icon:'▱', message:'I have around $1,500 saved and want to buy a $2,000 laptop sometime next semester. Can I afford it?', data:laptop },
 { id:'apartment', title:'Moving apartments', icon:'⌂', message:'My annual salary is $55,000. My car payment is $350/month and I have student loans. I want to move on February 1, 2027 to an apartment costing $1,400/month instead of my current $1,000 rent. Can I swing it?', data:apartment }
];

export const samplePrompts = samples.map(({ id, title, icon, message }) => ({ id, title, icon, message }));
