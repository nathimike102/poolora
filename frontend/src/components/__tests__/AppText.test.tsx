import React from 'react';
import { render } from '@testing-library/react-native';
import { AppText } from '../AppText';

describe('AppText', () => {
  it('renders correctly with default props', () => {
    const { getByText } = render(<AppText>Hello World</AppText>);
    expect(getByText('Hello World')).toBeTruthy();
  });

  it('applies custom styling', () => {
    const { getByText } = render(<AppText style={{ color: 'red' }}>Styled Text</AppText>);
    const element = getByText('Styled Text');
    expect(element.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: 'red' })]));
  });
});
