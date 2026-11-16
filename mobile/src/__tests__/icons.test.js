import { render, screen, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import BedIcon from '../components/BedIcon';
import BuildingIcon from '../components/BuildingIcon';
import FloorIcon from '../components/FloorIcon';
import RoomIcon from '../components/RoomIcon';
import { colors, MIN_TOUCH } from '../theme';

const flat = (el) => StyleSheet.flatten(el.props.style);

describe('BedIcon', () => {
  test.each([
    ['vacant', colors.vacant, colors.vacant, 'Free', '+'],
    ['paid', colors.paid, colors.paid, 'Paid', '✓'],
    ['partial', colors.partial, colors.partial, 'Part paid', '½'],
    ['overdue', colors.overdue, colors.overdue, 'Overdue', '!'],
    ['pending', '#FFFFFF', colors.paid, 'Due', '⏳'],
  ])('%s -> right colour, label and symbol', async (status, bg, border, label, symbol) => {
    await render(<BedIcon label="A" status={status} />);
    const box = screen.getByTestId('bed-icon');
    expect(box).toHaveStyle({ backgroundColor: bg, borderColor: border });
    expect(screen.getByTestId('bed-icon-status')).toHaveTextContent(label);
    expect(screen.getByTestId('bed-icon-symbol')).toHaveTextContent(symbol);
    expect(screen.getByText('A')).toBeOnTheScreen();
    expect(box.props.accessibilityLabel).toBe(`Bed A, ${label}`);
  });

  test('pending is an outline (white fill), not a solid blue like paid', async () => {
    await render(<BedIcon label="B" status="pending" />);
    const style = flat(screen.getByTestId('bed-icon'));
    expect(style.backgroundColor).toBe('#FFFFFF');
    expect(style.borderColor).toBe(colors.paid);
  });

  test('unknown status shows a neutral "?" instead of crashing', async () => {
    await render(<BedIcon label="C" status="weird" />);
    expect(screen.getByTestId('bed-icon-symbol')).toHaveTextContent('?');
    expect(screen.getByTestId('bed-icon-status')).toHaveTextContent('Unknown');
  });

  test('is a button of at least 56dp when pressable', async () => {
    const onPress = jest.fn();
    await render(<BedIcon label="A" status="vacant" onPress={onPress} />);
    const btn = screen.getByRole('button', { name: 'Bed A, Free' });
    const style = flat(btn);
    expect(style.width).toBeGreaterThanOrEqual(MIN_TOUCH);
    expect(style.height).toBeGreaterThanOrEqual(MIN_TOUCH);
    await fireEvent.press(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('BuildingIcon', () => {
  test('shows photo, name and free/total badge', async () => {
    await render(<BuildingIcon name="Shanti PG" photoUrl="https://x/y.jpg" freeBeds={3} totalBeds={20} />);
    expect(screen.getByTestId('building-icon-photo')).toBeOnTheScreen();
    expect(screen.getByText('Shanti PG')).toBeOnTheScreen();
    expect(screen.getByText('3/20 free')).toBeOnTheScreen();
    expect(screen.getByTestId('building-icon-badge')).toHaveStyle({ backgroundColor: colors.vacant });
  });

  test('placeholder when there is no photo; grey badge when full', async () => {
    await render(<BuildingIcon name="Sai" photoUrl={null} freeBeds={0} totalBeds={10} />);
    expect(screen.getByTestId('building-icon-placeholder')).toBeOnTheScreen();
    expect(screen.queryByTestId('building-icon-photo')).not.toBeOnTheScreen();
    expect(screen.getByTestId('building-icon-badge')).toHaveStyle({ backgroundColor: colors.unknown });
  });
});

describe('FloorIcon', () => {
  test('floor number and free count', async () => {
    await render(<FloorIcon floorNumber={2} freeBeds={5} />);
    expect(screen.getByText('Floor 2')).toBeOnTheScreen();
    expect(screen.getByText('5 free')).toBeOnTheScreen();
  });

  test('floor 0 is the ground floor', async () => {
    await render(<FloorIcon floorNumber={0} freeBeds={0} />);
    expect(screen.getByText('Ground floor')).toBeOnTheScreen();
    expect(screen.getByText('G')).toBeOnTheScreen();
  });
});

describe('RoomIcon', () => {
  test('2-bed room is square with 2 pips', async () => {
    await render(<RoomIcon roomNumber="101" bedCapacity={2} />);
    const style = flat(screen.getByTestId('room-icon'));
    expect(style.width).toBe(style.height);
    expect(screen.getAllByTestId('room-icon-pip')).toHaveLength(2);
    expect(screen.getByText('2 beds')).toBeOnTheScreen();
  });

  test('3-bed room is wider with 3 pips', async () => {
    await render(<RoomIcon roomNumber="102" bedCapacity={3} />);
    const style = flat(screen.getByTestId('room-icon'));
    expect(style.width).toBeGreaterThan(style.height);
    expect(screen.getAllByTestId('room-icon-pip')).toHaveLength(3);
    expect(screen.getByText('3 beds')).toBeOnTheScreen();
  });
});
