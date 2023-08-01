import React from 'react';
import {Dimensions} from 'react-native';
import lodashGet from 'lodash/get';
import _ from 'underscore';
import {withOnyx} from 'react-native-onyx';
import * as Report from '../../../../../libs/actions/Report';
import withLocalize, {withLocalizePropTypes} from '../../../../../components/withLocalize';
import PopoverWithMeasuredContent from '../../../../../components/PopoverWithMeasuredContent';
import BaseReactionList from '../BaseReactionList';
import compose from '../../../../../libs/compose';
import withCurrentUserPersonalDetails from '../../../../../components/withCurrentUserPersonalDetails';
import * as PersonalDetailsUtils from '../../../../../libs/PersonalDetailsUtils';
import * as EmojiUtils from '../../../../../libs/EmojiUtils';
import CONST from '../../../../../CONST';
import ONYXKEYS from '../../../../../ONYXKEYS';
import EmojiReactionsPropTypes from '../../../../../components/Reactions/EmojiReactionsPropTypes';

const propTypes = {
    emojiReactions: EmojiReactionsPropTypes,

    ...withLocalizePropTypes,
};

const defaultProps = {
    emojiReactions: {},
};

class BasePopoverReactionList extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            isPopoverVisible: false,
            cursorRelativePosition: {
                horizontal: 0,
                vertical: 0,
            },

            // The horizontal and vertical position (relative to the screen) where the popover will display.
            popoverAnchorPosition: {
                horizontal: 0,
                vertical: 0,
            },
            users: [],
            emojiCodes: [],
            emojiName: '',
            emojiCount: 0,
            hasUserReacted: false,
        };

        this.onPopoverHideActionCallback = () => {};
        this.reactionListAnchor = undefined;
        this.showReactionList = this.showReactionList.bind(this);
        this.hideReactionList = this.hideReactionList.bind(this);
        this.measureReactionListPosition = this.measureReactionListPosition.bind(this);
        this.getReactionListMeasuredLocation = this.getReactionListMeasuredLocation.bind(this);
        this.getReactionInformation = this.getReactionInformation.bind(this);
        this.dimensionsEventListener = null;
        this.contentRef = React.createRef();
    }

    componentDidMount() {
        this.dimensionsEventListener = Dimensions.addEventListener('change', this.measureReactionListPosition);
    }

    shouldComponentUpdate(nextProps, nextState) {
        const previousLocale = lodashGet(this.props, 'preferredLocale', CONST.LOCALES.DEFAULT);
        const nextLocale = lodashGet(nextProps, 'preferredLocale', CONST.LOCALES.DEFAULT);

        return (
            this.props.reportActionID !== nextProps.reportActionID ||
            !_.isEqual(this.props.emojiReactions, nextProps.emojiReactions) ||
            !_.isEqual(this.state, nextState) ||
            previousLocale !== nextLocale
        );
    }

    componentDidUpdate() {
        // Hide the list when all reactions are removed
        if (this.state.isPopoverVisible && !_.some(lodashGet(this.props.emojiReactions, [this.state.emojiName, 'users']), (user) => !_.isNull(user))) {
            this.hideReactionList();
        }

        const selectedReaction = lodashGet(this.props.emojiReactions, [this.state.emojiName]);
        const {emojiCount, emojiCodes, hasUserReacted, users} = this.getReactionInformation(selectedReaction);
        this.setState({
            users,
            emojiCodes,
            emojiCount,
            hasUserReacted,
        });
    }

    componentWillUnmount() {
        if (!this.dimensionsEventListener) {
            return;
        }
        this.dimensionsEventListener.remove();
    }

    /**
     * Get the BasePopoverReactionList anchor position
     * We calculate the achor coordinates from measureInWindow async method
     *
     * @returns {Promise<Object>}
     */
    getReactionListMeasuredLocation() {
        return new Promise((resolve) => {
            if (this.reactionListAnchor) {
                this.reactionListAnchor.measureInWindow((x, y) => resolve({x, y}));
            } else {
                resolve({x: 0, y: 0});
            }
        });
    }

    /**
     * Get the reaction information.
     *
     * @param {Object} selectedReaction
     * @returns {Object}
     */
    getReactionInformation(selectedReaction) {
        if (!selectedReaction) {
            return {
                users: [],
                emojiCodes: [],
                emojiName: '',
                emojiCount: 0,
            };
        }
        const reactionUsers = _.pick(selectedReaction.users, _.identity);
        const emojiCount = _.map(reactionUsers, (user) => user).length;
        const userAccountIDs = _.map(reactionUsers, (user, accountID) => Number(accountID));
        const emoji = EmojiUtils.findEmojiByName(selectedReaction.emojiName);
        const emojiCodes = EmojiUtils.getUniqueEmojiCodes(emoji, selectedReaction.users);
        const hasUserReacted = Report.hasAccountIDEmojiReacted(this.props.currentUserPersonalDetails.accountID, reactionUsers);
        const users = PersonalDetailsUtils.getPersonalDetailsByIDs(userAccountIDs, this.props.currentUserPersonalDetails.accountID, true);
        return {
            emojiCount,
            emojiCodes,
            hasUserReacted,
            users,
        };
    }

    /**
     * Show the ReactionList modal popover.
     *
     * @param {Object} [event] - A press event.
     * @param {Element} reactionListAnchor - reactionListAnchor
     * @param {String} emojiName - Name of emoji
     */
    showReactionList(event, reactionListAnchor, emojiName) {
        const nativeEvent = event.nativeEvent || {};
        this.reactionListAnchor = reactionListAnchor;
        const selectedReaction = lodashGet(this.props.emojiReactions, [emojiName]);
        const {emojiCount, emojiCodes, hasUserReacted, users} = this.getReactionInformation(selectedReaction);
        this.getReactionListMeasuredLocation().then(({x, y}) => {
            this.setState({
                cursorRelativePosition: {
                    horizontal: nativeEvent.pageX - x,
                    vertical: nativeEvent.pageY - y,
                },
                popoverAnchorPosition: {
                    horizontal: nativeEvent.pageX,
                    vertical: nativeEvent.pageY,
                },
                users,
                emojiName,
                emojiCodes,
                emojiCount,
                isPopoverVisible: true,
                hasUserReacted,
            });
        });
    }

    /**
     * This gets called on Dimensions change to find the anchor coordinates for the action BasePopoverReactionList.
     */
    measureReactionListPosition() {
        if (!this.state.isPopoverVisible) {
            return;
        }
        this.getReactionListMeasuredLocation().then(({x, y}) => {
            if (!x || !y) {
                return;
            }
            this.setState((prev) => ({
                popoverAnchorPosition: {
                    horizontal: prev.cursorRelativePosition.horizontal + x,
                    vertical: prev.cursorRelativePosition.vertical + y,
                },
            }));
        });
    }

    /**
     * Hide the ReactionList modal popover.
     */
    hideReactionList() {
        this.setState({
            isPopoverVisible: false,
        });
    }

    render() {
        return (
            <>
                <PopoverWithMeasuredContent
                    isVisible={this.state.isPopoverVisible}
                    onClose={this.hideReactionList}
                    anchorPosition={this.state.popoverAnchorPosition}
                    animationIn="fadeIn"
                    disableAnimation={false}
                    animationOutTiming={1}
                    shouldSetModalVisibility={false}
                    fullscreen
                >
                    <BaseReactionList
                        type={this.state.type}
                        isVisible
                        users={this.state.users}
                        emojiName={this.state.emojiName}
                        emojiCodes={this.state.emojiCodes}
                        emojiCount={this.state.emojiCount}
                        onClose={this.hideReactionList}
                        hasUserReacted={this.state.hasUserReacted}
                    />
                </PopoverWithMeasuredContent>
            </>
        );
    }
}

BasePopoverReactionList.propTypes = propTypes;
BasePopoverReactionList.defaultProps = defaultProps;

export default compose(
    withLocalize,
    withCurrentUserPersonalDetails,
    withOnyx({
        emojiReactions: {
            key: ({reportActionID}) => `${ONYXKEYS.COLLECTION.REPORT_ACTIONS_REACTIONS}${reportActionID}`,
        },
    }),
)(BasePopoverReactionList);
